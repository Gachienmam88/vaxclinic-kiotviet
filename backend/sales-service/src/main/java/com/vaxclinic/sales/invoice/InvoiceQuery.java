package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.address.AdminUnitCodes;
import com.vaxclinic.sales.customer.CustomerRepository;
import com.vaxclinic.sales.delivery.ShipmentInvoiceHooks;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceListResponse;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceResponse;
import com.vaxclinic.sales.invoice.InvoiceDtos.LineResponse;
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

    private final InvoiceQueryRepository queries;
    private final InvoiceRepository invoices;
    private final CustomerRepository customers;
    private final ShipmentInvoiceHooks shipments;
    private final EInvoiceLookupClient einvoices;

    public InvoiceQuery(InvoiceQueryRepository queries, InvoiceRepository invoices, CustomerRepository customers,
                        ShipmentInvoiceHooks shipments, EInvoiceLookupClient einvoices) {
        this.einvoices = einvoices;
        this.shipments = shipments;
        this.queries = queries;
        this.invoices = invoices;
        this.customers = customers;
    }

    public InvoiceListResponse search(Filter f) {
        boolean needEInvoices = (f.einvoiceStatuses() != null && !f.einvoiceStatuses().isEmpty())
                || (f.einvoiceNatures() != null && !f.einvoiceNatures().isEmpty());
        return queries.search(f, needEInvoices ? einvoices.idsByStatus() : null);
    }

    @Transactional(readOnly = true)
    public InvoiceResponse detail(UUID id) {
        Invoice inv = invoices.findById(id).orElseThrow(() ->
                com.vaxclinic.common.error.BusinessException.notFound("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
        var customer = inv.getCustomerId() == null ? null : customers.findById(inv.getCustomerId()).orElse(null);
        // Số lượng đã trả của từng dòng (phiếu trả hàng còn hiệu lực) → màn trả hàng chỉ cho trả phần còn lại
        var returned = queries.returnedByLine(id);
        var lines = inv.getLines().stream().map(l -> {
            BigDecimal price = l.getUnitPrice().subtract(l.getDiscount());
            return new LineResponse(l.getId(), l.getLineNo(), l.getProductId(), l.getUnitId(), l.getProductCode(),
                    l.getProductName(), l.getUnitName(), l.getQuantity(), l.getUnitPrice(), l.getDiscount(), price,
                    InvoiceMath.money(l.getQuantity().multiply(price)), l.getCost(), l.getLots(), l.getNote(),
                    l.getTaxCode(), returned.getOrDefault(l.getId(), BigDecimal.ZERO), l.isTaxReduced());
        }).toList();
        var payments = queries.payments(id);
        return new InvoiceResponse(inv.getId(), inv.getCode(), inv.getBranchId(), inv.getCustomerId(),
                customer == null ? null : customer.getCode(), inv.getCustomerName(),
                customer == null ? null : customer.getPhone(), inv.getSellerId(), inv.getSellerName(),
                inv.getCreatedByName(), inv.getSoldAt(), inv.getStatus(), inv.getSaleMode(), inv.getSubtotal(),
                inv.getDiscount(), inv.getTotal(), inv.getPaid(), inv.getPaymentMethod(), inv.getNote(), inv.isOffline(),
                inv.getRevision(), lines, payments, inv.getOrderId(), inv.getOrderId() == null ? null : queries.orderCode(inv.getOrderId()),
                inv.getPriceBookId(), inv.getPriceBookName(), inv.getSalesChannel(), queries.channelName(inv.getSalesChannel()), shipments.info(id),
                customer == null ? null : AdminUnitCodes.joinAddress(customer.getAddress(), customer.getWard(), customer.getProvince()),
                inv.einvoiceBuyer(), inv.getTaxReduction(), inv.prescriptionInfo(),
                inv.getTaxReductionMethod());
    }

    /** 10 lần bán gần nhất của 1 hàng; có khách thì lấy giá đã bán cho khách đó trước. */
    public List<InvoiceDtos.RecentPrice> recentPrices(UUID productId, UUID customerId) {
        return queries.recentPrices(productId, customerId);
    }
}
