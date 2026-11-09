package com.vaxclinic.sales.invoice.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import com.vaxclinic.sales.delivery.dto.ShipmentDtos;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class InvoiceDtos {

    private InvoiceDtos() {
    }

    /** Giới hạn độ dài = cột invoice_lines / customer_order_lines → dữ liệu quá dài bị chặn 400 trước khi trừ kho. */
    public record LineInput(@NotNull UUID productId, @NotNull UUID unitId,
                            @NotBlank @Size(max = 50, message = "Mã hàng tối đa 50 ký tự") String productCode,
                            @NotBlank @Size(max = 250, message = "Tên hàng tối đa 250 ký tự") String productName,
                            @NotBlank @Size(max = 50, message = "Đơn vị tính tối đa 50 ký tự") String unitName,
                            @NotNull @DecimalMin(value = "0.001", message = "Số lượng phải > 0") BigDecimal quantity,
                            @NotNull @DecimalMin("0") BigDecimal unitPrice, @DecimalMin("0") BigDecimal discount,
                            @Size(max = 500) String note, @Size(max = 30) String taxCode) {
    }

    /**
     * id: do máy bán hàng sinh (UUID) — gửi lại cùng id khi đồng bộ offline.
     * orderId: hóa đơn tạo từ đơn đặt hàng ("Tạo hóa đơn") — tiền cọc của đơn tính vào khách đã trả.
     * priceBookId/Name: bảng giá áp dụng (null = Bảng giá chung); salesChannel: mã kênh bán (trống = DIRECT);
     * delivery: thông tin giao hàng khi saleMode = DELIVERY → tạo vận đơn cùng hóa đơn.
     */
    public record InvoiceRequest(@NotNull UUID id, @NotNull UUID branchId, UUID customerId, UUID sellerId,
                                 @Size(max = 150) String sellerName, Instant soldAt,
                                 @Pattern(regexp = "QUICK|NORMAL|DELIVERY") String saleMode,
                                 @DecimalMin("0") BigDecimal discount, @DecimalMin("0") BigDecimal paidAmount,
                                 @Pattern(regexp = "CASH|TRANSFER|CARD|EWALLET") String paymentMethod,
                                 UUID bankAccountId, String note, boolean offline,
                                 @NotEmpty(message = "Hóa đơn chưa có hàng") @Valid List<LineInput> lines, UUID orderId,
                                 UUID priceBookId, @Size(max = 150) String priceBookName, @Size(max = 30) String salesChannel,
                                 @Valid ShipmentDtos.DeliveryInput delivery,
                                 @Valid List<ExtraPayment> extraPayments, @Valid EInvoiceBuyer einvoiceBuyer) {
        public InvoiceRequest withOrderId(UUID order) {
            return new InvoiceRequest(id, branchId, customerId, sellerId, sellerName, soldAt, saleMode, discount, paidAmount,
                    paymentMethod, bankAccountId, note, offline, lines, order, priceBookId, priceBookName, salesChannel, delivery,
                    extraPayments, einvoiceBuyer);
        }
    }

    /**
     * Thanh toán nhiều phương thức (chỉ khi tạo hóa đơn mới): mỗi khoản thêm = 1 phiếu thu TT{mã}-2, TT{mã}-3...
     * paidAmount của hóa đơn vẫn là khoản của phương thức chính.
     */
    public record ExtraPayment(@NotNull @Pattern(regexp = "CASH|TRANSFER|CARD|EWALLET") String method,
                               @NotNull @DecimalMin(value = "1", message = "Số tiền thanh toán phải > 0") BigDecimal amount,
                               UUID bankAccountId) {
    }

    /** "Thông tin xuất HĐĐT" nhập trên hóa đơn; null / để trống hết = không có (lấy theo khách hàng). */
    public record EInvoiceBuyer(@Size(max = 200) String buyerName, @Size(max = 250) String companyName,
                                @Size(max = 20) String taxCode, @Size(max = 500) String address,
                                @Email(message = "Email không hợp lệ") @Size(max = 150) String email,
                                @Size(max = 20) String phone) {
    }

    /** salesChannel = null: giữ nguyên kênh bán. */
    public record InfoRequest(UUID sellerId, @Size(max = 150) String sellerName, Instant soldAt, String note,
                              @Size(max = 30) String salesChannel) {
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
                                  List<LineResponse> lines, List<PaymentResponse> payments, UUID orderId, String orderCode,
                                  UUID priceBookId, String priceBookName, String salesChannel, String salesChannelName,
                                  ShipmentDtos.ShipmentInfo shipment, String customerAddress, EInvoiceBuyer einvoiceBuyer) {
    }

    public record InvoiceListItem(UUID id, String code, Instant soldAt, String customerCode, String customerName,
                                  String sellerName, BigDecimal subtotal, BigDecimal discount, BigDecimal total,
                                  BigDecimal paid, String status, String paymentMethod,
                                  /* Trạng thái hiển thị: PROCESSING / COMPLETED / FAILED_DELIVERY / CANCELLED */ String state,
                                  String saleMode, /* Mã phiếu trả hàng còn hiệu lực, cách nhau ", " */ String returnCodes) {
    }

    public record InvoiceListResponse(List<InvoiceListItem> items, long total, int page, int size, BigDecimal sumSubtotal,
                                      BigDecimal sumDiscount, BigDecimal sumTotal, BigDecimal sumPaid) {
    }
}
