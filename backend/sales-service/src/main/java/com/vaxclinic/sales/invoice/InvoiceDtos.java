package com.vaxclinic.sales.invoice;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class InvoiceDtos {

    private InvoiceDtos() {
    }

    public record LineInput(@NotNull UUID productId, @NotNull UUID unitId, @NotBlank String productCode,
                            @NotBlank String productName, @NotBlank String unitName,
                            @NotNull @DecimalMin(value = "0.001", message = "Số lượng phải > 0") BigDecimal quantity,
                            @NotNull @DecimalMin("0") BigDecimal unitPrice, @DecimalMin("0") BigDecimal discount,
                            @Size(max = 500) String note, @Size(max = 30) String taxCode) {
    }

    /** id: do máy bán hàng sinh (UUID) — gửi lại cùng id khi đồng bộ offline. */
    public record InvoiceRequest(@NotNull UUID id, @NotNull UUID branchId, UUID customerId, UUID sellerId,
                                 @Size(max = 150) String sellerName, Instant soldAt,
                                 @Pattern(regexp = "QUICK|NORMAL|DELIVERY") String saleMode,
                                 @DecimalMin("0") BigDecimal discount, @DecimalMin("0") BigDecimal paidAmount,
                                 @Pattern(regexp = "CASH|TRANSFER|CARD|EWALLET") String paymentMethod,
                                 UUID bankAccountId, String note, boolean offline,
                                 @NotEmpty(message = "Hóa đơn chưa có hàng") @Valid List<LineInput> lines) {
    }

    public record InfoRequest(UUID sellerId, @Size(max = 150) String sellerName, Instant soldAt, String note) {
    }

    public record LineResponse(UUID id, int lineNo, UUID productId, UUID unitId, String productCode, String productName,
                               String unitName, BigDecimal quantity, BigDecimal unitPrice, BigDecimal discount,
                               BigDecimal price, BigDecimal amount, BigDecimal cost, String lots, String note,
                               String taxCode, BigDecimal returnedQuantity) {
    }

    public record TaxCodeChange(@NotNull UUID lineId, @Size(max = 30) String taxCode) {
    }

    public record RecentPrice(String invoiceCode, Instant soldAt, String customerName, BigDecimal quantity, BigDecimal price) {
    }

    public record PaymentResponse(UUID voucherId, String code, Instant occurredAt, String createdByName,
                                  BigDecimal voucherAmount, String fund, String status, BigDecimal allocated) {
    }

    public record InvoiceResponse(UUID id, String code, UUID branchId, UUID customerId, String customerCode,
                                  String customerName, String customerPhone, UUID sellerId, String sellerName,
                                  String createdByName, Instant soldAt, String status, String saleMode,
                                  BigDecimal subtotal, BigDecimal discount, BigDecimal total, BigDecimal paid,
                                  String paymentMethod, String note, boolean offline, int revision,
                                  List<LineResponse> lines, List<PaymentResponse> payments) {
    }

    public record InvoiceListItem(UUID id, String code, Instant soldAt, String customerCode, String customerName,
                                  String sellerName, BigDecimal subtotal, BigDecimal discount, BigDecimal total,
                                  BigDecimal paid, String status, String paymentMethod) {
    }

    public record InvoiceListResponse(List<InvoiceListItem> items, long total, int page, int size, BigDecimal sumSubtotal,
                                      BigDecimal sumDiscount, BigDecimal sumTotal, BigDecimal sumPaid) {
    }
}
