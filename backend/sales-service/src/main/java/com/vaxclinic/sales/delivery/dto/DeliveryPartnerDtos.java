package com.vaxclinic.sales.delivery.dto;

import com.vaxclinic.common.address.AdminUnitCodes;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class DeliveryPartnerDtos {

    private DeliveryPartnerDtos() {
    }

    /**
     * code trống → tự sinh DT000001. partnerType: MANUAL (cập nhật trạng thái tay) — chừa chỗ cho tích hợp hãng
     * vận chuyển sau này (GHN, GHTK...), hiện chưa có tích hợp API nào.
     */
    public record PartnerRequest(@Size(max = 30) @Pattern(regexp = "^$|^[A-Za-z0-9_.-]+$", message = "Mã chỉ gồm chữ, số, - _ .") String code,
                                 @NotBlank(message = "Chưa nhập tên đối tác") @Size(max = 200) String name,
                                 @Size(max = 20) String phone, @Email(message = "Email không hợp lệ") @Size(max = 150) String email,
                                 @Size(max = 300) String address, @Size(max = 2000) String note,
                                 @Pattern(regexp = "MANUAL") String partnerType, Boolean active,
                                 @Size(max = 100) String province, @Size(max = 100) String ward,
                                 @Pattern(regexp = AdminUnitCodes.PROVINCE, message = AdminUnitCodes.PROVINCE_MSG) String provinceCode,
                                 @Pattern(regexp = AdminUnitCodes.WARD, message = AdminUnitCodes.WARD_MSG) String wardCode) {
    }

    /** Dòng danh sách: tổng đơn (trừ đã hủy), phí giao hàng, cần thu hộ (đơn chưa chuyển hoàn), nợ hiện tại. */
    public record PartnerRow(UUID id, String code, String name, String phone, String email, String address, String note,
                             String partnerType, boolean active, long shipmentCount, BigDecimal totalFee, BigDecimal totalCod,
                             BigDecimal debt, Instant createdAt, String province, String ward, String provinceCode,
                             String wardCode) {
    }

    public record PartnerListResponse(List<PartnerRow> items, long total, int page, int size, BigDecimal sumFee,
                                      BigDecimal sumCod, BigDecimal sumDebt) {
    }

    public record LedgerRow(UUID id, String docType, UUID docId, String docCode, BigDecimal amount, BigDecimal balanceAfter,
                            String note, Instant occurredAt) {
    }

    /** Vận đơn đã kết thúc (Giao thành công / Đã chuyển hoàn), chưa đối soát. net = thu hộ − phí cửa hàng trả. */
    public record ReconcileRow(UUID id, String code, String invoiceCode, String receiverName, String status, UUID branchId,
                               BigDecimal cod, BigDecimal fee, BigDecimal net, Instant deliveredAt) {
    }

    public record SettlementRow(UUID id, String code, String kind, UUID branchId, BigDecimal codTotal, BigDecimal feeTotal,
                                BigDecimal amount, int shipmentCount, String voucherCode, String status, String note,
                                String createdByName, Instant createdAt) {
    }

    /** Đối soát: các vận đơn chọn → 1 phiếu thu (đối tác trả) hoặc phiếu chi (cửa hàng trả) theo số chênh lệch. */
    public record ReconcileRequest(@NotNull UUID branchId, @NotEmpty(message = "Chưa chọn vận đơn") List<UUID> shipmentIds,
                                   @Pattern(regexp = "CASH|BANK|EWALLET") String fund, UUID bankAccountId,
                                   @Size(max = 500) String note) {
    }

    /** Thanh toán tự do: RECEIPT = đối tác trả cửa hàng (giảm nợ đối tác), PAYMENT = cửa hàng trả đối tác. */
    public record PaymentRequest(@NotNull UUID branchId, @NotBlank @Pattern(regexp = "RECEIPT|PAYMENT") String direction,
                                 @NotNull @DecimalMin(value = "1", message = "Số tiền phải lớn hơn 0") BigDecimal amount,
                                 @Pattern(regexp = "CASH|BANK|EWALLET") String fund, UUID bankAccountId,
                                 @Size(max = 500) String note) {
    }
}
