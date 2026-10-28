package com.vaxclinic.sales.order;

import com.vaxclinic.sales.invoice.InvoiceDtos.LineInput;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class OrderDtos {

    private OrderDtos() {
    }

    /**
     * Tạo / sửa đơn đặt hàng từ màn bán hàng. id: máy bán hàng sinh (gửi lại không tạo trùng).
     * paidAmount: khách trả thêm lần này (đặt cọc) → phiếu thu Sổ quỹ; tổng đã trả không vượt khách cần trả.
     */
    public record OrderRequest(@NotNull UUID id, @NotNull UUID branchId,
                               @NotNull(message = "Đặt hàng phải chọn khách hàng") UUID customerId,
                               UUID sellerId, @Size(max = 150) String sellerName,
                               @DecimalMin("0") BigDecimal discount, @DecimalMin("0") BigDecimal paidAmount,
                               @Pattern(regexp = "CASH|TRANSFER|CARD|EWALLET") String paymentMethod,
                               UUID bankAccountId, String note,
                               @NotEmpty(message = "Đơn đặt hàng chưa có hàng") @Valid List<LineInput> lines) {
    }

    public record OrderLineResponse(UUID id, int lineNo, UUID productId, UUID unitId, String productCode,
                                    String productName, String unitName, BigDecimal quantity, BigDecimal unitPrice,
                                    BigDecimal discount, BigDecimal price, BigDecimal amount, String note, String taxCode) {
    }

    /** Phiếu thu đặt cọc (RECEIPT) / phiếu chi hoàn cọc khi hủy đơn (PAYMENT). */
    public record OrderPayment(UUID voucherId, String code, String voucherType, Instant occurredAt, String createdByName,
                               BigDecimal amount, String fund, String status) {
    }

    public record OrderResponse(UUID id, String code, UUID branchId, UUID customerId, String customerCode,
                                String customerName, String customerPhone, UUID sellerId, String sellerName,
                                String createdByName, Instant orderedAt, String status, BigDecimal subtotal,
                                BigDecimal discount, BigDecimal total, BigDecimal deposit, String note,
                                UUID invoiceId, String invoiceCode, Instant cancelledAt,
                                List<OrderLineResponse> lines, List<OrderPayment> payments) {
    }

    public record OrderListItem(UUID id, String code, Instant orderedAt, String customerCode, String customerName,
                                String createdByName, BigDecimal subtotal, BigDecimal discount, BigDecimal total,
                                BigDecimal deposit, String status, String invoiceCode) {
    }

    public record OrderListResponse(List<OrderListItem> items, long total, int page, int size, BigDecimal sumSubtotal,
                                    BigDecimal sumTotal, BigDecimal sumDeposit) {
    }
}
