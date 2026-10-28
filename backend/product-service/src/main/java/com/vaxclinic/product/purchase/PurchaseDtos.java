package com.vaxclinic.product.purchase;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** DTO phiếu nhập + trả hàng nhập. */
public final class PurchaseDtos {

    private PurchaseDtos() {
    }

    public record ReceiptLineInput(@NotNull UUID productId, @NotNull UUID unitId,
                                   @NotNull @DecimalMin(value = "0.001", message = "Số lượng phải > 0") BigDecimal quantity,
                                   @NotNull @DecimalMin("0") BigDecimal unitPrice,
                                   @DecimalMin("0") BigDecimal discount,
                                   @Size(max = 50) String lotNumber, LocalDate expiryDate) {
    }

    public record ReceiptRequest(@NotNull UUID branchId, UUID supplierId, Instant receivedAt,
                                 UUID receiverId, @Size(max = 150) String receiverName,
                                 @Size(max = 50) String inputInvoiceNo,
                                 @DecimalMin("0") @DecimalMax("100") BigDecimal vatRate,
                                 @DecimalMin("0") BigDecimal discount, @DecimalMin("0") BigDecimal paidAmount,
                                 @Size(max = 20) String paymentMethod, String note,
                                 @Valid List<ReceiptLineInput> lines) {
    }

    /** Sửa thông tin phiếu đã nhập (không đụng tới hàng / tiền). */
    public record ReceiptInfoRequest(Instant receivedAt, UUID receiverId, @Size(max = 150) String receiverName,
                                     @Size(max = 50) String inputInvoiceNo, String note) {
    }

    public record LineResponse(UUID id, int lineNo, UUID productId, String productCode, String productName,
                               UUID unitId, String unitName, BigDecimal conversionRate, BigDecimal quantity,
                               BigDecimal unitPrice, BigDecimal discount, BigDecimal priceWithVat,
                               BigDecimal amount, String lotNumber, LocalDate expiryDate) {
    }

    public record ReceiptResponse(UUID id, String code, UUID branchId, String status, Instant receivedAt,
                                  UUID supplierId, String supplierCode, String supplierName,
                                  UUID createdBy, String createdByName, UUID receiverId, String receiverName,
                                  String inputInvoiceNo, BigDecimal vatRate, BigDecimal subtotal, BigDecimal discount,
                                  BigDecimal vatAmount, BigDecimal total, BigDecimal paidAmount, String paymentMethod,
                                  String note, Instant completedAt, Instant cancelledAt, List<LineResponse> lines) {
    }

    public record ReceiptListItem(UUID id, String code, String status, Instant receivedAt, String supplierCode,
                                  String supplierName, String inputInvoiceNo, String createdByName,
                                  String receiverName, BigDecimal subtotal, BigDecimal discount,
                                  BigDecimal vatAmount, BigDecimal total, BigDecimal paidAmount) {
    }

    public record ListTotals(BigDecimal subtotal, BigDecimal discount, BigDecimal vatAmount, BigDecimal total,
                             BigDecimal paidAmount) {
    }

    public record ReceiptListResponse(List<ReceiptListItem> items, long total, int page, int size, ListTotals sums) {
    }

    // ===== Trả hàng nhập =====

    public record ReturnLineInput(@NotNull UUID productId, @NotNull UUID unitId,
                                  @NotNull @DecimalMin(value = "0.001", message = "Số lượng phải > 0") BigDecimal quantity,
                                  @NotNull @DecimalMin("0") BigDecimal unitPrice, @Size(max = 50) String lotNumber) {
    }

    public record ReturnRequest(@NotNull UUID branchId, UUID supplierId, UUID receiptId, Instant returnedAt,
                                UUID returnerId, @Size(max = 150) String returnerName,
                                @DecimalMin("0") @DecimalMax("100") BigDecimal vatRate,
                                @DecimalMin("0") BigDecimal discount, @DecimalMin("0") BigDecimal refundAmount,
                                String note, @Valid List<ReturnLineInput> lines) {
    }

    public record ReturnLineResponse(UUID id, int lineNo, UUID productId, String productCode, String productName,
                                     UUID unitId, String unitName, BigDecimal conversionRate, BigDecimal quantity,
                                     BigDecimal unitPrice, BigDecimal amount, String lotNumber) {
    }

    public record ReturnResponse(UUID id, String code, UUID branchId, String status, Instant returnedAt,
                                 UUID supplierId, String supplierCode, String supplierName, UUID receiptId,
                                 String receiptCode, String createdByName, UUID returnerId, String returnerName,
                                 BigDecimal subtotal, BigDecimal discount, BigDecimal vatRate, BigDecimal vatAmount,
                                 BigDecimal total, BigDecimal refundAmount, String note, List<ReturnLineResponse> lines) {
    }

    public record ReturnListItem(UUID id, String code, String status, Instant returnedAt, String supplierName,
                                 String receiptCode, String returnerName, BigDecimal subtotal, BigDecimal discount,
                                 BigDecimal vatAmount, BigDecimal total, BigDecimal refundAmount) {
    }

    public record ReturnListResponse(List<ReturnListItem> items, long total, int page, int size, ListTotals sums) {
    }

    /** Người dùng hiện tại lấy từ JWT. */
    public record Actor(UUID id, String name, List<String> branchIds) {
    }
}
