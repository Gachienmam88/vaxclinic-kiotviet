package com.vaxclinic.identity.storeprofile.dto;

import com.vaxclinic.common.address.AdminUnitCodes;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Dữ liệu "Hồ sơ cửa hàng". Lưu ở app_settings: "owner_profile" (thông tin chủ gian hàng, không trùng với "store"),
 * "store_pause" (bảo lưu), "session_cutoff" (mốc vô hiệu mọi phiên). Email / điện thoại / địa chỉ dùng chung "store".
 */
public final class StoreProfileModels {

    private StoreProfileModels() {
    }

    /** businessType: PERSONAL (Cá nhân) / HOUSEHOLD (Hộ kinh doanh) / ENTERPRISE (Doanh nghiệp); gender: MALE / FEMALE. */
    public record OwnerProfile(String businessType, LocalDate birthDate, String representative, String idNumber,
                               LocalDate idIssueDate, String idIssuePlace, String gender) {
    }

    /** reopenOn: ngày tự mở lại (gian hàng bảo lưu khi hôm nay < reopenOn); reopenedAt: mở lại sớm. Mỗi gian hàng chỉ 1 lần. */
    public record StorePause(LocalDate pausedOn, LocalDate reopenOn, Instant reopenedAt, UUID pausedBy) {
    }

    /** JWT có iat < notBefore (epoch giây) bị gateway từ chối (đổi tên gian hàng → đăng xuất mọi thiết bị). */
    public record SessionCutoff(long notBefore) {
    }

    /** Trạng thái công khai (gateway + màn hình thông báo bảo lưu). */
    public record StoreStatus(boolean paused, LocalDate reopenOn, boolean pauseUsed, long sessionsNotBefore) {
    }

    public record ProfileRequest(
            @NotNull @Pattern(regexp = "PERSONAL|HOUSEHOLD|ENTERPRISE", message = "Loại hình kinh doanh không hợp lệ") String businessType,
            @NotBlank(message = "Nhập email") @Email(message = "Email không hợp lệ") @Size(max = 150) String email,
            @NotNull(message = "Chọn giới tính") @Pattern(regexp = "MALE|FEMALE", message = "Giới tính không hợp lệ") String gender,
            @NotBlank(message = "Nhập số CCCD/Hộ chiếu")
            @Pattern(regexp = "[A-Za-z0-9]{8,12}", message = "CCCD/Hộ chiếu gồm 8–12 chữ hoặc số") String idNumber,
            @NotNull(message = "Nhập ngày sinh") @Past(message = "Ngày sinh phải trước hôm nay") LocalDate birthDate,
            @NotNull(message = "Nhập ngày cấp") @PastOrPresent(message = "Ngày cấp không được sau hôm nay") LocalDate idIssueDate,
            @Size(max = 200) String idIssuePlace,
            @NotBlank(message = "Nhập người đại diện") @Size(max = 150) String representative,
            @NotBlank(message = "Nhập địa chỉ") @Size(max = 500) String address,
            @Size(max = 100) String province, @Size(max = 100) String ward,
            @Pattern(regexp = AdminUnitCodes.PROVINCE, message = AdminUnitCodes.PROVINCE_MSG) String provinceCode,
            @Pattern(regexp = AdminUnitCodes.WARD, message = AdminUnitCodes.WARD_MSG) String wardCode,
            @NotBlank String verifyToken) {
    }

    public record PhoneRequest(@NotBlank @Pattern(regexp = "0\\d{9}", message = "Số điện thoại gồm 10 số, bắt đầu bằng 0") String phone,
                               @NotBlank String verifyToken) {
    }

    public record RenameRequest(@NotBlank @Pattern(regexp = "[a-z0-9]{3,40}",
            message = "Tên gian hàng gồm 3–40 chữ thường không dấu hoặc số") String accessCode, @NotBlank String verifyToken) {
    }

    public record TransferRequest(@NotNull UUID targetUserId, @NotBlank String verifyToken) {
    }

    public record PauseRequest(@NotNull LocalDate reopenOn, @NotBlank String verifyToken) {
    }

    /** purpose: PROFILE / PHONE / RENAME / TRANSFER / PAUSE. */
    public record VerifyRequest(@NotBlank @Pattern(regexp = "PROFILE|PHONE|RENAME|TRANSFER|PAUSE") String purpose,
                                String password, String code) {
    }

    public record VerifyResponse(String verifyToken, Instant expiresAt) {
    }

    public record UserRef(UUID id, String username, String fullName) {
    }

    /** Toàn bộ màn "Thông tin gian hàng". */
    public record ProfileView(String businessType, LocalDate birthDate, String representative, String idNumber,
                              LocalDate idIssueDate, String idIssuePlace, String gender, String email, String phone,
                              String address, String province, String ward, String provinceCode, String wardCode,
                              String storeName, String accessCode, String industry, long branchCount, StoreStatus status,
                              UserRef owner, boolean isOwner, boolean twoFactorEnabled) {
    }
}
