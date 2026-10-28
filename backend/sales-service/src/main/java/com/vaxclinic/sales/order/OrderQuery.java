package com.vaxclinic.sales.order;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.customer.CustomerRepository;
import com.vaxclinic.sales.invoice.InvoiceMath;
import com.vaxclinic.sales.order.OrderDtos.OrderLineResponse;
import com.vaxclinic.sales.order.OrderDtos.OrderListItem;
import com.vaxclinic.sales.order.OrderDtos.OrderListResponse;
import com.vaxclinic.sales.order.OrderDtos.OrderPayment;
import com.vaxclinic.sales.order.OrderDtos.OrderResponse;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Danh sách đặt hàng (bộ lọc trái + dòng tổng) và chi tiết (dòng hàng + phiếu thu cọc / phiếu chi hoàn cọc). */
@Component
public class OrderQuery {

    public record Filter(String q, List<String> statuses, Instant from, Instant to, UUID createdBy, UUID customerId,
                         UUID branchId, int page, int size) {
    }

    private final NamedParameterJdbcTemplate jdbc;
    private final CustomerOrderRepository orders;
    private final CustomerRepository customers;

    public OrderQuery(NamedParameterJdbcTemplate jdbc, CustomerOrderRepository orders, CustomerRepository customers) {
        this.jdbc = jdbc;
        this.orders = orders;
        this.customers = customers;
    }

    public OrderListResponse search(Filter f) {
        var p = new MapSqlParameterSource();
        var w = new StringBuilder(" from customer_orders o join customers c on c.id = o.customer_id"
                + " left join invoices i on i.id = o.invoice_id where 1=1");
        if (f.q() != null && !f.q().isBlank()) {
            w.append(" and (o.code ilike :q or o.customer_name ilike :q or c.code ilike :q or c.phone ilike :q)");
            p.addValue("q", "%" + f.q().trim() + "%");
        }
        if (f.statuses() != null && !f.statuses().isEmpty()) {
            w.append(" and o.status in (:statuses)");
            p.addValue("statuses", f.statuses());
        }
        if (f.from() != null) {
            w.append(" and o.ordered_at >= :from");
            p.addValue("from", Timestamp.from(f.from()));
        }
        if (f.to() != null) {
            w.append(" and o.ordered_at < :to");
            p.addValue("to", Timestamp.from(f.to()));
        }
        if (f.createdBy() != null) {
            w.append(" and o.created_by = :createdBy");
            p.addValue("createdBy", f.createdBy());
        }
        if (f.customerId() != null) {
            w.append(" and o.customer_id = :customerId");
            p.addValue("customerId", f.customerId());
        }
        if (f.branchId() != null) {
            w.append(" and o.branch_id = :branchId");
            p.addValue("branchId", f.branchId());
        }
        var agg = jdbc.queryForMap("select count(*) cnt, coalesce(sum(o.subtotal),0) sub, coalesce(sum(o.total),0) tot,"
                + " coalesce(sum(o.deposit),0) dep" + w, p);
        p.addValue("limit", f.size()).addValue("offset", (long) f.page() * f.size());
        var items = jdbc.query("select o.*, c.code customer_code, i.code invoice_code" + w
                        + " order by o.ordered_at desc limit :limit offset :offset", p,
                (rs, n) -> new OrderListItem(rs.getObject("id", UUID.class), rs.getString("code"),
                        rs.getTimestamp("ordered_at").toInstant(), rs.getString("customer_code"), rs.getString("customer_name"),
                        rs.getString("created_by_name"), rs.getBigDecimal("subtotal"), rs.getBigDecimal("discount"),
                        rs.getBigDecimal("total"), rs.getBigDecimal("deposit"), rs.getString("status"),
                        rs.getString("invoice_code"),
                        rs.getTimestamp("expected_delivery_at") == null ? null : rs.getTimestamp("expected_delivery_at").toInstant(),
                        rs.getString("sales_channel")));
        return new OrderListResponse(items, ((Number) agg.get("cnt")).longValue(), f.page(), f.size(),
                (BigDecimal) agg.get("sub"), (BigDecimal) agg.get("tot"), (BigDecimal) agg.get("dep"));
    }

    @Transactional(readOnly = true)
    public OrderResponse detail(UUID id) {
        CustomerOrder o = orders.findById(id)
                .orElseThrow(() -> BusinessException.notFound("ORDER_NOT_FOUND", "Không tìm thấy đơn đặt hàng"));
        var customer = customers.findById(o.getCustomerId()).orElse(null);
        var lines = o.getLines().stream().map(l -> {
            BigDecimal price = l.getUnitPrice().subtract(l.getDiscount());
            return new OrderLineResponse(l.getId(), l.getLineNo(), l.getProductId(), l.getUnitId(), l.getProductCode(),
                    l.getProductName(), l.getUnitName(), l.getQuantity(), l.getUnitPrice(), l.getDiscount(), price,
                    InvoiceMath.money(l.getQuantity().multiply(price)), l.getNote(), l.getTaxCode());
        }).toList();
        var payments = jdbc.query("""
                select id, code, voucher_type, occurred_at, created_by_name, amount, fund, status from cash_vouchers
                where source_type = 'ORDER' and source_id = :id order by occurred_at, code""",
                new MapSqlParameterSource("id", id), (rs, n) -> new OrderPayment(rs.getObject("id", UUID.class),
                        rs.getString("code"), rs.getString("voucher_type"), rs.getTimestamp("occurred_at").toInstant(),
                        rs.getString("created_by_name"), rs.getBigDecimal("amount"), rs.getString("fund"), rs.getString("status")));
        String invoiceCode = o.getInvoiceId() == null ? null : jdbc.queryForObject("select code from invoices where id = :id",
                new MapSqlParameterSource("id", o.getInvoiceId()), String.class);
        return new OrderResponse(o.getId(), o.getCode(), o.getBranchId(), o.getCustomerId(),
                customer == null ? null : customer.getCode(), o.getCustomerName(), customer == null ? null : customer.getPhone(),
                o.getSellerId(), o.getSellerName(), o.getCreatedByName(), o.getOrderedAt(), o.getStatus(), o.getSubtotal(),
                o.getDiscount(), o.getTotal(), o.getDeposit(), o.getNote(), o.getInvoiceId(), invoiceCode, o.getCancelledAt(),
                lines, payments, o.getPriceBookId(), o.getPriceBookName(), o.getSalesChannel(), o.getExpectedDeliveryAt());
    }
}
