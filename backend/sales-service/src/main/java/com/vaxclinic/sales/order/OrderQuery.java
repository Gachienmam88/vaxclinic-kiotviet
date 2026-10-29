package com.vaxclinic.sales.order;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.customer.CustomerRepository;
import com.vaxclinic.sales.invoice.InvoiceMath;
import com.vaxclinic.sales.order.OrderDtos.OrderLineResponse;
import com.vaxclinic.sales.order.OrderDtos.OrderListResponse;
import com.vaxclinic.sales.order.OrderDtos.OrderResponse;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Danh sách đặt hàng (bộ lọc trái + dòng tổng) và chi tiết (dòng hàng + phiếu thu cọc / phiếu chi hoàn cọc). */
@Component
public class OrderQuery {

    /**
     * productQ: mã / tên hàng; customerQ: mã / tên / SĐT khách; deliveryFrom/To: thời gian giao dự kiến; sellerId: người nhận đặt;
     * channels: kênh bán; paymentMethods: quỹ của phiếu cọc (CASH / BANK / EWALLET).
     */
    public record Filter(String q, List<String> statuses, Instant from, Instant to, UUID createdBy, UUID customerId,
                         UUID branchId, int page, int size, String productQ, String customerQ, Instant deliveryFrom,
                         Instant deliveryTo, UUID sellerId, List<String> channels, List<String> paymentMethods) {
    }

    private final OrderQueryRepository queries;
    private final CustomerOrderRepository orders;
    private final CustomerRepository customers;

    public OrderQuery(OrderQueryRepository queries, CustomerOrderRepository orders, CustomerRepository customers) {
        this.queries = queries;
        this.orders = orders;
        this.customers = customers;
    }

    public OrderListResponse search(Filter f) {
        return queries.search(f);
    }

    public OrderDtos.ExportResponse export(Filter f) {
        return queries.export(f);
    }

    @Transactional(readOnly = true)
    public OrderResponse detail(UUID id) {
        CustomerOrder o = orders.findById(id)
                .orElseThrow(() -> BusinessException.notFound("ORDER_NOT_FOUND", "Không tìm thấy đơn đặt hàng"));
        var customer = customers.findById(o.getCustomerId()).orElse(null);
        var delivered = o.getInvoiceId() == null ? java.util.Map.<String, BigDecimal>of() : queries.deliveredByLine(o.getInvoiceId());
        var lines = o.getLines().stream().map(l -> {
            BigDecimal price = l.getUnitPrice().subtract(l.getDiscount());
            return new OrderLineResponse(l.getId(), l.getLineNo(), l.getProductId(), l.getUnitId(), l.getProductCode(),
                    l.getProductName(), l.getUnitName(), l.getQuantity(), l.getUnitPrice(), l.getDiscount(), price,
                    InvoiceMath.money(l.getQuantity().multiply(price)), l.getNote(), l.getTaxCode(),
                    o.getInvoiceId() == null ? BigDecimal.ZERO : l.getQuantity().min(delivered.getOrDefault(l.getProductId() + "|" + l.getUnitId(), BigDecimal.ZERO)));
        }).toList();
        var payments = queries.payments(id);
        String invoiceCode = o.getInvoiceId() == null ? null : queries.invoiceCode(o.getInvoiceId());
        return new OrderResponse(o.getId(), o.getCode(), o.getBranchId(), o.getCustomerId(),
                customer == null ? null : customer.getCode(), o.getCustomerName(), customer == null ? null : customer.getPhone(),
                o.getSellerId(), o.getSellerName(), o.getCreatedByName(), o.getOrderedAt(), o.getStatus(), o.getSubtotal(),
                o.getDiscount(), o.getTotal(), o.getDeposit(), o.getNote(), o.getInvoiceId(), invoiceCode, o.getCancelledAt(),
                lines, payments, o.getPriceBookId(), o.getPriceBookName(), o.getSalesChannel(), o.getExpectedDeliveryAt());
    }
}
