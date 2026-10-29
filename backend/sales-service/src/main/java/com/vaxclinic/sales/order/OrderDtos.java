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
                               @NotEmpty(message = "Đơn đặt hàng chưa có hàng") @Valid List<LineInput> lines,
                               UUID priceBookId, @Size(max = 150) String priceBookName, @Size(max = 30) String salesChannel,
                               Instant expectedDeliveryAt) {
    }

    public record OrderLineResponse(UUID id, int lineNo, UUID productId, UUID unitId, String productCode,
                                    String productName, String unitName, BigDecimal quantity, BigDecimal unitPrice,
                                    BigDecimal discount, BigDecimal price, BigDecimal amount, String note, String taxCode,
                                    BigDecimal deliveredQuantity) {
        // deliveredQuantity: đã giao = số lượng trên hóa đơn (còn hiệu lực) tạo từ đơn, cùng hàng + đơn vị, tối đa số đặt
    }

    /** Sửa nhanh ở chi tiết đơn ("Lưu"): người nhận đặt, ngày đặt, kênh bán, dự kiến giao, trạng thái (Phiếu tạm / Đã xác nhận), ghi chú. */
    public record InfoRequest(UUID sellerId, @Size(max = 150) String sellerName, Instant orderedAt, @Size(max = 30) String salesChannel,
                              Instant expectedDeliveryAt, @Pattern(regexp = "DRAFT|CONFIRMED") String status, String note,
                              @Valid Area area) {
    }

    /** Khu vực giao hàng: Tỉnh/Thành + Phường/Xã (mã + tên; chuỗi rỗng = bỏ trống). null ở InfoRequest = giữ nguyên. */
    public record Area(@Size(max = 100) String province, @Size(max = 10) String provinceCode, @Size(max = 100) String ward,
                       @Size(max = 10) String wardCode) {
    }

    /** "Gộp đơn": các đơn cùng khách cần gộp (đơn cũ nhất giữ lại làm đơn gộp). */
    public record MergeRequest(@NotNull UUID branchId,
                               @NotNull @Size(min = 2, max = 50, message = "Chọn ít nhất 2 đơn để gộp") List<UUID> orderIds) {
    }

    public record MergeCandidate(UUID id, String code, Instant orderedAt, String status, BigDecimal total, BigDecimal deposit) {
    }

    /** Nhóm gộp được: ≥ 2 đơn mở của cùng 1 khách, cùng chi nhánh, tạo trong 7 ngày qua. */
    public record MergeGroup(UUID customerId, String customerCode, String customerName, String customerPhone,
                             List<MergeCandidate> orders) {
    }

    public record MergeCandidatesResponse(List<MergeGroup> groups) {
    }

    /** "Xuất file": đơn khớp bộ lọc (tối đa 5.000) + dòng hàng. */
    public record ExportLine(UUID orderId, String productCode, String productName, String unitName, BigDecimal quantity,
                             BigDecimal unitPrice, BigDecimal discount, BigDecimal amount) {
    }

    public record ExportResponse(List<OrderListItem> items, List<ExportLine> lines) {
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
                                List<OrderLineResponse> lines, List<OrderPayment> payments, UUID priceBookId,
                                String priceBookName, String salesChannel, Instant expectedDeliveryAt, Area area,
                                UUID mergedIntoId, String mergedIntoCode) {
    }

    public record OrderListItem(UUID id, String code, Instant orderedAt, String customerCode, String customerName,
                                String createdByName, BigDecimal subtotal, BigDecimal discount, BigDecimal total,
                                BigDecimal deposit, String status, String invoiceCode, Instant expectedDeliveryAt,
                                String salesChannel, String sellerName, String customerPhone, UUID invoiceId,
                                String receiverProvince, String receiverWard) {
    }

    public record OrderListResponse(List<OrderListItem> items, long total, int page, int size, BigDecimal sumSubtotal,
                                    BigDecimal sumTotal, BigDecimal sumDeposit) {
    }
}
