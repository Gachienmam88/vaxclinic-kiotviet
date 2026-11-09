package com.vaxclinic.sales.delivery.dto;

import com.vaxclinic.sales.delivery.service.ShipmentStatus;
import com.vaxclinic.common.address.AdminUnitCodes;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ShipmentDtos {

    private ShipmentDtos() {
    }

    /**
     * Thông tin giao hàng gửi kèm hóa đơn (màn bán hàng "Bán giao hàng"). Thu hộ (COD) do server tính = khách cần trả − đã trả.
     * feePayer: SHOP = cửa hàng trả phí cho đối tác; CUSTOMER = người nhận trả phí trực tiếp cho đối tác.
     */
    public record DeliveryInput(@NotNull(message = "Chưa chọn đối tác giao hàng") UUID partnerId,
                                @NotBlank(message = "Chưa nhập tên người nhận") @Size(max = 200) String receiverName,
                                @NotBlank(message = "Chưa nhập SĐT người nhận") @Size(max = 20) String receiverPhone,
                                @NotBlank(message = "Chưa nhập địa chỉ giao hàng") @Size(max = 300) String receiverAddress,
                                @Size(max = 150) String area, @Min(0) Integer weightGram,
                                @DecimalMin("0") BigDecimal shippingFee,
                                @Pattern(regexp = "SHOP|CUSTOMER") String feePayer, @Size(max = 1000) String note,
                                @Pattern(regexp = AdminUnitCodes.PROVINCE, message = AdminUnitCodes.PROVINCE_MSG) String provinceCode, @Pattern(regexp = AdminUnitCodes.WARD, message = AdminUnitCodes.WARD_MSG) String wardCode) {
    }

    /** Tóm tắt vận đơn hiện trên chi tiết hóa đơn và để màn bán hàng mở lại khi sửa hóa đơn. */
    public record ShipmentInfo(UUID id, String code, String status, UUID partnerId, String partnerName, String receiverName,
                               String receiverPhone, String receiverAddress, String area, Integer weightGram,
                               BigDecimal shippingFee, String feePayer, BigDecimal codAmount, String note, Instant deliveredAt,
                               String returnCode, String provinceCode, String wardCode) {
    }

    public record StatusLog(String fromStatus, String toStatus, String note, String changedByName, Instant changedAt) {
    }

    public record ShipmentListItem(UUID id, String code, Instant createdAt, UUID invoiceId, String invoiceCode,
                                   String customerName, String receiverName, String receiverPhone, String receiverAddress,
                                   String area, UUID partnerId, String partnerName, BigDecimal shippingFee, String feePayer,
                                   BigDecimal codAmount, String status, boolean reconciled, UUID branchId,
                                   String provinceCode, String wardCode) {
    }

    public record ShipmentListResponse(List<ShipmentListItem> items, long total, int page, int size, BigDecimal sumFee,
                                       BigDecimal sumCod, Map<String, Long> statusCounts) {
    }

    public record ShipmentDetail(ShipmentListItem item, Integer weightGram, String note, Instant deliveredAt, UUID returnId,
                                 String returnCode, String settlementCode, String createdByName, BigDecimal invoiceTotal,
                                 BigDecimal invoicePaid, BigDecimal feePosted, BigDecimal returnFee, List<StatusLog> logs) {
    }

    /** Sửa thông tin giao (chỉ khi Chờ xử lý / Đang lấy hàng). */
    public record UpdateRequest(@NotNull UUID partnerId, @NotBlank @Size(max = 200) String receiverName,
                                @NotBlank @Size(max = 20) String receiverPhone, @NotBlank @Size(max = 300) String receiverAddress,
                                @Size(max = 150) String area, @Min(0) Integer weightGram, @DecimalMin("0") BigDecimal shippingFee,
                                @Pattern(regexp = "SHOP|CUSTOMER") String feePayer, @Size(max = 1000) String note,
                                @Pattern(regexp = AdminUnitCodes.PROVINCE, message = AdminUnitCodes.PROVINCE_MSG) String provinceCode, @Pattern(regexp = AdminUnitCodes.WARD, message = AdminUnitCodes.WARD_MSG) String wardCode) {
    }

    /**
     * Đổi trạng thái 1 / nhiều vận đơn. Đã chuyển hoàn (cửa hàng đã nhận lại hàng) cần refundMethod: số khách đã trả trước
     * hoàn bằng CASH / TRANSFER (bankAccountId) hoặc CREDIT (giữ làm tiền khách trả trước, không lập phiếu chi).
     * shippingFee / returnFee: phí cửa hàng chịu (null = phí giao hàng của vận đơn, phí chuyển hoàn 0) — chỉ nhập khi 1 vận đơn.
     */
    public record StatusRequest(@NotEmpty(message = "Chưa chọn vận đơn") List<UUID> ids,
                                @NotBlank @Pattern(regexp = ShipmentStatus.PATTERN) String status, @Size(max = 500) String note,
                                @Pattern(regexp = "CASH|TRANSFER|CREDIT") String refundMethod, UUID bankAccountId,
                                @DecimalMin("0") BigDecimal shippingFee, @DecimalMin("0") BigDecimal returnFee) {

        public ReturnOptions returnOptions() {
            return new ReturnOptions(refundMethod, bankAccountId, shippingFee, returnFee);
        }
    }

    /** Tham số "Đã chuyển hoàn": cách hoàn tiền khách đã trả trước + phí cửa hàng chịu (null = mặc định). */
    public record ReturnOptions(String refundMethod, UUID bankAccountId, BigDecimal shippingFee, BigDecimal returnFee) {
    }

    /** "Tạo vận đơn" cho hóa đơn chưa có vận đơn đang hoạt động (VD vận đơn cũ đã hủy, giao lại qua đối tác khác). */
    public record CreateRequest(@NotNull UUID invoiceId, @NotNull @jakarta.validation.Valid DeliveryInput delivery) {
    }

    /** Kết quả cập nhật trạng thái từng vận đơn (cập nhật hàng loạt: vận đơn lỗi không chặn vận đơn khác). */
    public record StatusResult(UUID id, String code, boolean ok, String status, String message) {
    }
}
