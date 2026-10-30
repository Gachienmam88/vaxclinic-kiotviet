package com.vaxclinic.product.purchase;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** DTO phiếu nhập + trả hàng nhập. */
public final class PurchaseDtos {

    private PurchaseDtos() {
    }

    /** id: dòng đã có (bắt buộc khi sửa phiếu đã nhập — PUT /adjust). vatRate: VAT% dòng (null = KCT). */
    public record ReceiptLineInput(UUID id, @NotNull UUID productId, @NotNull UUID unitId,
                                   @NotNull @DecimalMin(value = "0.001", message = "Số lượng phải > 0") BigDecimal quantity,
                                   @NotNull @DecimalMin("0") BigDecimal unitPrice,
                                   @DecimalMin("0") BigDecimal discount,
                                   @Size(max = 50) String lotNumber, LocalDate expiryDate,
                                   @DecimalMin("0") @DecimalMax("100") BigDecimal vatRate, @Size(max = 500) String note) {
    }

    /**
     * vatMode: null = client cũ (1 mức vatRate cho mọi dòng); LINE = VAT% từng dòng; MANUAL = VAT phiếu nhập tay (vatAmount).
     * payNow: Lưu tạm có tiền trả NCC và người dùng chọn "lưu phiếu chi" → lập phiếu chi ngay (không chờ Hoàn thành).
     */
    public record ReceiptRequest(@NotNull UUID branchId, UUID supplierId, Instant receivedAt,
                                 UUID receiverId, @Size(max = 150) String receiverName,
                                 @Size(max = 50) String inputInvoiceNo,
                                 @DecimalMin("0") @DecimalMax("100") BigDecimal vatRate,
                                 @DecimalMin("0") BigDecimal discount, @DecimalMin("0") BigDecimal paidAmount,
                                 @Size(max = 20) String paymentMethod, String note,
                                 @Valid List<ReceiptLineInput> lines,
                                 @Pattern(regexp = "LINE|MANUAL", message = "Chế độ VAT không hợp lệ") String vatMode,
                                 @DecimalMin("0") BigDecimal vatAmount, Boolean payNow) {
    }

    /** Sửa thông tin phiếu đã nhập (không đụng tới hàng / tiền). */
    public record ReceiptInfoRequest(Instant receivedAt, UUID receiverId, @Size(max = 150) String receiverName,
                                     @Size(max = 50) String inputInvoiceNo, String note) {
    }

    public record LineResponse(UUID id, int lineNo, UUID productId, String productCode, String productName,
                               UUID unitId, String unitName, BigDecimal conversionRate, BigDecimal quantity,
                               BigDecimal unitPrice, BigDecimal discount, BigDecimal priceWithVat,
                               BigDecimal amount, String lotNumber, LocalDate expiryDate, BigDecimal vatRate, String note) {
    }

    public record ReceiptResponse(UUID id, String code, UUID branchId, String status, Instant receivedAt,
                                  UUID supplierId, String supplierCode, String supplierName,
                                  UUID createdBy, String createdByName, UUID receiverId, String receiverName,
                                  String inputInvoiceNo, BigDecimal vatRate, BigDecimal subtotal, BigDecimal discount,
                                  BigDecimal vatAmount, BigDecimal total, BigDecimal paidAmount, String paymentMethod,
                                  String note, Instant completedAt, Instant cancelledAt, List<LineResponse> lines,
                                  String vatMode, boolean paymentPosted, List<ReturnRef> returns) {
    }

    /** Phiếu trả hàng nhập lập theo phiếu nhập (mọi trạng thái, mới nhất trước). */
    public record ReturnRef(UUID id, String code, String status, Instant returnedAt, BigDecimal total) {
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
                                  @NotNull @DecimalMin("0") BigDecimal unitPrice, @Size(max = 50) String lotNumber,
                                  @DecimalMin("0") @DecimalMax("100") BigDecimal vatRate, @Size(max = 500) String note) {
    }

    /** vatMode / vatAmount như phiếu nhập; paymentMethod = hình thức NCC hoàn tiền (CASH / TRANSFER). */
    public record ReturnRequest(@NotNull UUID branchId, UUID supplierId, UUID receiptId, Instant returnedAt,
                                UUID returnerId, @Size(max = 150) String returnerName,
                                @DecimalMin("0") @DecimalMax("100") BigDecimal vatRate,
                                @DecimalMin("0") BigDecimal discount, @DecimalMin("0") BigDecimal refundAmount,
                                String note, @Valid List<ReturnLineInput> lines,
                                @Pattern(regexp = "LINE|MANUAL", message = "Chế độ VAT không hợp lệ") String vatMode,
                                @DecimalMin("0") BigDecimal vatAmount,
                                @Pattern(regexp = "CASH|TRANSFER", message = "Hình thức thanh toán không hợp lệ") String paymentMethod) {
    }

    /**
     * Số còn trả được của 1 dòng phiếu nhập (theo đơn vị của dòng) = đã nhập − đã trả (phiếu trả hoàn thành).
     * defaultVatRate = VAT% mặc định của dòng trả (xem {@link PurchaseMath#defaultReturnVatRate}).
     */
    public record ReturnableLine(UUID lineId, UUID productId, String lotNumber, BigDecimal received, BigDecimal returnable,
                                 BigDecimal defaultVatRate) {
    }

    public record ReturnLineResponse(UUID id, int lineNo, UUID productId, String productCode, String productName,
                                     UUID unitId, String unitName, BigDecimal conversionRate, BigDecimal quantity,
                                     BigDecimal unitPrice, BigDecimal amount, String lotNumber, BigDecimal vatRate,
                                     String note, BigDecimal priceWithVat) {
    }

    public record ReturnResponse(UUID id, String code, UUID branchId, String status, Instant returnedAt,
                                 UUID supplierId, String supplierCode, String supplierName, UUID receiptId,
                                 String receiptCode, String createdByName, UUID returnerId, String returnerName,
                                 BigDecimal subtotal, BigDecimal discount, BigDecimal vatRate, BigDecimal vatAmount,
                                 BigDecimal total, BigDecimal refundAmount, String note, List<ReturnLineResponse> lines,
                                 String vatMode, String paymentMethod) {
    }

    public record ReturnListItem(UUID id, String code, String status, Instant returnedAt, String supplierName,
                                 String receiptCode, String returnerName, BigDecimal subtotal, BigDecimal discount,
                                 BigDecimal vatAmount, BigDecimal total, BigDecimal refundAmount, UUID receiptId,
                                 String createdByName, UUID branchId, String note, String supplierCode) {
    }

    public record ReturnListResponse(List<ReturnListItem> items, long total, int page, int size, ListTotals sums) {
    }

    /** Người dùng hiện tại lấy từ JWT. */
    public record Actor(UUID id, String name, List<String> branchIds) {

        /** sub, name, claim "branches" (thiếu claim → danh sách rỗng). */
        public static Actor of(Jwt jwt) {
            List<String> branches = jwt.getClaimAsStringList("branches");
            return new Actor(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"), branches == null ? List.of() : branches);
        }
    }
}
