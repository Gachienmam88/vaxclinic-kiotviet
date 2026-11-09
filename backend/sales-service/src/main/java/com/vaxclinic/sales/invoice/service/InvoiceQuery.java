package com.vaxclinic.sales.invoice.service;

import com.vaxclinic.sales.invoice.client.EInvoiceLookupClient;
import com.vaxclinic.sales.invoice.entity.Invoice;
import com.vaxclinic.sales.invoice.dto.InvoiceDtos;
import com.vaxclinic.sales.invoice.repository.InvoiceRepository;
import com.vaxclinic.common.address.AdminUnitCodes;
import com.vaxclinic.sales.customer.repository.CustomerRepository;
import com.vaxclinic.sales.delivery.service.ShipmentInvoiceHooks;
import com.vaxclinic.sales.invoice.dto.InvoiceDtos.InvoiceListItem;
import com.vaxclinic.sales.invoice.dto.InvoiceDtos.InvoiceListResponse;
import com.vaxclinic.sales.invoice.dto.InvoiceDtos.InvoiceResponse;
import com.vaxclinic.sales.invoice.dto.InvoiceDtos.LineResponse;
import com.vaxclinic.sales.invoice.dto.InvoiceDtos.PaymentResponse;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Danh sách hóa đơn (bộ lọc trái + dòng tổng) và chi tiết (dòng hàng + lịch sử thanh toán). */
@Component
public class InvoiceQuery {

    /**
     * statuses = trạng thái lưu (COMPLETED / CANCELLED); states = trạng thái hiển thị KiotViet (PROCESSING / COMPLETED /
     * FAILED_DELIVERY / CANCELLED); deliveries = DELIVERY / NONE; returnStates = HAS / NONE;
     * einvoiceStatuses = NONE / PUBLISHED / ACCEPTED / FAILED; einvoiceNatures = ORIGINAL / ADJUST / REPLACE.
     */
    public record Filter(String q, List<String> statuses, Instant from, Instant to, UUID createdBy, UUID sellerId,
                         List<String> paymentMethods, UUID customerId, UUID branchId, int page, int size,
                         List<UUID> ids, List<String> states, List<String> deliveries, List<String> returnStates,
                         List<String> einvoiceStatuses, List<String> einvoiceNatures, String customerQ, String productQ,
                         String noteQ) {

        /** Bộ lọc cũ (dashboard / tab bán hàng của khách) — không dùng các lọc mới. */
        public Filter(String q, List<String> statuses, Instant from, Instant to, UUID createdBy, UUID sellerId,
                      List<String> paymentMethods, UUID customerId, UUID branchId, int page, int size) {
            this(q, statuses, from, to, createdBy, sellerId, paymentMethods, customerId, branchId, page, size,
                    null, null, null, null, null, null, null, null, null);
        }
    }

    private final NamedParameterJdbcTemplate jdbc;
    private final InvoiceRepository invoices;
    private final CustomerRepository customers;
    private final ShipmentInvoiceHooks shipments;
    private final EInvoiceLookupClient einvoices;

    public InvoiceQuery(NamedParameterJdbcTemplate jdbc, InvoiceRepository invoices, CustomerRepository customers,
                        ShipmentInvoiceHooks shipments, EInvoiceLookupClient einvoices) {
        this.einvoices = einvoices;
        this.shipments = shipments;
        this.jdbc = jdbc;
        this.invoices = invoices;
        this.customers = customers;
    }

    public InvoiceListResponse search(Filter f) {
        var p = new MapSqlParameterSource();
        boolean needEInvoices = (f.einvoiceStatuses() != null && !f.einvoiceStatuses().isEmpty())
                || (f.einvoiceNatures() != null && !f.einvoiceNatures().isEmpty());
        String w = InvoiceFilterSql.where(f, p, needEInvoices ? einvoices.idsByStatus() : null);
        var agg = jdbc.queryForMap("select count(*) cnt, coalesce(sum(i.subtotal),0) sub, coalesce(sum(i.discount),0) disc,"
                + " coalesce(sum(i.total),0) tot, coalesce(sum(i.paid),0) paid" + w, p);
        p.addValue("limit", f.size()).addValue("offset", (long) f.page() * f.size());
        var items = jdbc.query("select i.*, c.code customer_code, " + InvoiceFilterSql.STATE + " state,"
                + " (select string_agg(r.code, ', ' order by r.created_at) from sales_returns r where r.invoice_id = i.id"
                + " and r.status = 'COMPLETED') return_codes" + w + " order by i.sold_at desc limit :limit offset :offset", p,
                (rs, n) -> new InvoiceListItem(rs.getObject("id", UUID.class), rs.getString("code"),
                        rs.getTimestamp("sold_at").toInstant(), rs.getString("customer_code"), rs.getString("customer_name"),
                        rs.getString("seller_name"), rs.getBigDecimal("subtotal"), rs.getBigDecimal("discount"),
                        rs.getBigDecimal("total"), rs.getBigDecimal("paid"), rs.getString("status"),
                        rs.getString("payment_method"), rs.getString("state"), rs.getString("sale_mode"),
                        rs.getString("return_codes")));
        return new InvoiceListResponse(items, ((Number) agg.get("cnt")).longValue(), f.page(), f.size(),
                (BigDecimal) agg.get("sub"), (BigDecimal) agg.get("disc"), (BigDecimal) agg.get("tot"), (BigDecimal) agg.get("paid"));
    }

    @Transactional(readOnly = true)
    public InvoiceResponse detail(UUID id) {
        Invoice inv = invoices.findById(id).orElseThrow(() ->
                com.vaxclinic.common.error.BusinessException.notFound("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
        var customer = inv.getCustomerId() == null ? null : customers.findById(inv.getCustomerId()).orElse(null);
        // Số lượng đã trả của từng dòng (phiếu trả hàng còn hiệu lực) → màn trả hàng chỉ cho trả phần còn lại
        var returned = new java.util.HashMap<UUID, BigDecimal>();
        jdbc.query("""
                select rl.invoice_line_id, sum(rl.quantity) qty from sales_return_lines rl join sales_returns r on r.id = rl.return_id
                where r.invoice_id = :id and r.status = 'COMPLETED' group by rl.invoice_line_id""",
                new MapSqlParameterSource("id", id), rs -> {
                    returned.put(rs.getObject(1, UUID.class), rs.getBigDecimal(2));
                });
        var lines = inv.getLines().stream().map(l -> {
            BigDecimal price = l.getUnitPrice().subtract(l.getDiscount());
            return new LineResponse(l.getId(), l.getLineNo(), l.getProductId(), l.getUnitId(), l.getProductCode(),
                    l.getProductName(), l.getUnitName(), l.getQuantity(), l.getUnitPrice(), l.getDiscount(), price,
                    InvoiceMath.money(l.getQuantity().multiply(price)), l.getCost(), l.getLots(), l.getNote(),
                    l.getTaxCode(), returned.getOrDefault(l.getId(), BigDecimal.ZERO));
        }).toList();
        var payments = jdbc.query("""
                select v.id, v.code, v.occurred_at, v.created_by_name, v.amount, v.fund, v.status, a.amount allocated
                from voucher_allocations a join cash_vouchers v on v.id = a.voucher_id
                where a.invoice_id = :id order by v.occurred_at""", new MapSqlParameterSource("id", id),
                (rs, n) -> new PaymentResponse(rs.getObject("id", UUID.class), rs.getString("code"),
                        rs.getTimestamp("occurred_at").toInstant(), rs.getString("created_by_name"),
                        rs.getBigDecimal("amount"), rs.getString("fund"), rs.getString("status"), rs.getBigDecimal("allocated")));
        return new InvoiceResponse(inv.getId(), inv.getCode(), inv.getBranchId(), inv.getCustomerId(),
                customer == null ? null : customer.getCode(), inv.getCustomerName(),
                customer == null ? null : customer.getPhone(), inv.getSellerId(), inv.getSellerName(),
                inv.getCreatedByName(), inv.getSoldAt(), inv.getStatus(), inv.getSaleMode(), inv.getSubtotal(),
                inv.getDiscount(), inv.getTotal(), inv.getPaid(), inv.getPaymentMethod(), inv.getNote(), inv.isOffline(),
                inv.getRevision(), lines, payments, inv.getOrderId(), inv.getOrderId() == null ? null : jdbc.queryForObject(
                        "select code from customer_orders where id = :id", new MapSqlParameterSource("id", inv.getOrderId()), String.class),
                inv.getPriceBookId(), inv.getPriceBookName(), inv.getSalesChannel(), jdbc.queryForObject(
                        "select coalesce((select name from sales_channels where code = :c), :c)",
                        new MapSqlParameterSource("c", inv.getSalesChannel()), String.class), shipments.info(id),
                customer == null ? null : AdminUnitCodes.joinAddress(customer.getAddress(), customer.getWard(), customer.getProvince()),
                inv.einvoiceBuyer());
    }

    /** 10 lần bán gần nhất của 1 hàng; có khách thì lấy giá đã bán cho khách đó trước. */
    public List<InvoiceDtos.RecentPrice> recentPrices(UUID productId, UUID customerId) {
        var p = new MapSqlParameterSource("productId", productId).addValue("customerId", customerId);
        return jdbc.query("""
                select i.code, i.sold_at, i.customer_name, l.quantity, l.unit_price - l.discount price
                from invoice_lines l join invoices i on i.id = l.invoice_id
                where l.product_id = :productId and i.status = 'COMPLETED'
                order by (case when i.customer_id = cast(:customerId as uuid) then 0 else 1 end), i.sold_at desc
                limit 10""", p, (rs, n) -> new InvoiceDtos.RecentPrice(rs.getString("code"),
                rs.getTimestamp("sold_at").toInstant(), rs.getString("customer_name"), rs.getBigDecimal("quantity"),
                rs.getBigDecimal("price")));
    }
}
