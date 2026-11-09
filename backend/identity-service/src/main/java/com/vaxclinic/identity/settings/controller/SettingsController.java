package com.vaxclinic.identity.settings.controller;

import com.vaxclinic.identity.settings.repository.SettingsStore;
import com.vaxclinic.common.address.AdminUnitCodes;
import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.settings.ShopSettings;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Thiết lập cửa hàng. Mọi user đăng nhập được đọc (màn bán hàng cần quy tắc khách hàng, mẫu in cần thông tin cửa hàng);
 * chỉ quyền settings.manage được sửa. Các service khác đọc qua /internal/settings.
 */
@RestController
public class SettingsController {

    private static final Set<String> CUSTOMER_FIELDS = Set.of("phone", "email", "gender", "birthday", "address", "facebook", "group");

    /**
     * Thông tin cửa hàng: dùng cho đầu mẫu in và màn đăng nhập. logo: ảnh data URL đã thu nhỏ phía trình duyệt.
     * accessCode: "địa chỉ truy cập cửa hàng" nhập ở bước đầu đăng nhập (chữ thường, số); trống → tự sinh từ tên cửa hàng.
     */
    public record StoreInfo(@NotBlank @Size(max = 200) String name, @Size(max = 20) String phone,
                            @Email @Size(max = 150) String email, @Size(max = 500) String address,
                            @Size(max = 100) String province, @Size(max = 100) String ward,
                            @Size(max = 20) String taxCode, @Size(max = 400_000) String logo,
                            @jakarta.validation.constraints.Pattern(regexp = "[a-z0-9]{3,40}",
                                    message = "Địa chỉ truy cập gồm 3–40 chữ thường không dấu hoặc số") String accessCode,
                            @jakarta.validation.constraints.Pattern(regexp = AdminUnitCodes.PROVINCE, message = AdminUnitCodes.PROVINCE_MSG) String provinceCode,
                            @jakarta.validation.constraints.Pattern(regexp = AdminUnitCodes.WARD, message = AdminUnitCodes.WARD_MSG) String wardCode) {
    }

    public record SalesRequest(boolean allowNegativeStock, boolean blockEditPublishedEInvoice,
                               boolean lockTransactionTime, @Min(1) @Max(3650) Integer returnLimitDays) {
    }

    public record CustomerRequest(List<String> requiredFields, BigDecimal debtLimit) {
    }

    public record LockRequest(boolean enabled, java.util.Map<UUID, java.time.LocalDate> branches) {
    }

    /** accessCode: địa chỉ truy cập cửa hàng đang có hiệu lực (đã đặt hoặc tự sinh từ tên). */
    public record AllSettings(StoreInfo store, ShopSettings.Sales sales, ShopSettings.CustomerRules customer,
                              ShopSettings.BookLock lock, String accessCode) {
    }

    private final SettingsStore store;
    private final AuditLogger audit;

    public SettingsController(SettingsStore store, AuditLogger audit) {
        this.store = store;
        this.audit = audit;
    }

    /** Ghi lịch sử thao tác (tính năng "Thiết lập cửa hàng" / "Người dùng"). */
    private void log(Jwt jwt, String feature, String action, String detail) {
        audit.record(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"), null, feature, action, null, detail);
    }

    @GetMapping("/api/settings")
    public AllSettings all() {
        ShopSettings s = store.shop();
        StoreInfo info = store.read("store", StoreInfo.class);
        return new AllSettings(info, s.sales(), s.customer(), s.lock(), StoreAccessController.accessCodeOf(info));
    }

    @GetMapping("/internal/settings")
    @PreAuthorize("hasAuthority('internal')")
    public ShopSettings internal() {
        return store.shop();
    }

    @PutMapping("/api/settings/store")
    @PreAuthorize("hasAuthority('settings.manage')")
    public AllSettings saveStore(@Valid @RequestBody StoreInfo req, @AuthenticationPrincipal Jwt jwt) {
        if (req.logo() != null && !req.logo().isEmpty() && !req.logo().startsWith("data:image/")) {
            throw BusinessException.badRequest("INVALID_LOGO", "Ảnh đại diện không hợp lệ");
        }
        // Địa chỉ truy cập chỉ đổi qua Hồ sơ cửa hàng → Đổi tên gian hàng (chủ gian hàng, đăng xuất mọi thiết bị);
        // luôn ghi tường minh mã đang dùng để đổi tên cửa hàng không làm đổi địa chỉ tự sinh.
        String current = StoreAccessController.accessCodeOf(store.read("store", StoreInfo.class));
        if (req.accessCode() != null && !req.accessCode().isBlank() && !req.accessCode().equals(current)) {
            throw BusinessException.badRequest("ACCESS_CODE_LOCKED",
                    "Đổi địa chỉ truy cập tại Hồ sơ cửa hàng → Cập nhật → Đổi tên gian hàng");
        }
        store.write("store", new StoreInfo(req.name(), req.phone(), req.email(), req.address(), req.province(), req.ward(),
                req.taxCode(), req.logo(), current, req.provinceCode(), req.wardCode()), userId(jwt));
        log(jwt, "Thiết lập cửa hàng", "Sửa", "Cập nhật thông tin cửa hàng: " + req.name());
        return all();
    }

    @PutMapping("/api/settings/sales")
    @PreAuthorize("hasAuthority('settings.manage')")
    public AllSettings saveSales(@Valid @RequestBody SalesRequest req, @AuthenticationPrincipal Jwt jwt) {
        store.write("sales", new ShopSettings.Sales(req.allowNegativeStock(), req.blockEditPublishedEInvoice(),
                req.lockTransactionTime(), req.returnLimitDays()), userId(jwt));
        log(jwt, "Thiết lập cửa hàng", "Sửa", "Thiết lập đơn hàng: bán khi hết tồn " + yes(req.allowNegativeStock())
                + ", chặn sửa/hủy HĐ đã phát hành HĐĐT " + yes(req.blockEditPublishedEInvoice())
                + ", khóa thời gian giao dịch " + yes(req.lockTransactionTime())
                + ", giới hạn trả hàng " + (req.returnLimitDays() == null ? "Không" : req.returnLimitDays() + " ngày"));
        return all();
    }

    @PutMapping("/api/settings/customer")
    @PreAuthorize("hasAuthority('settings.manage')")
    public AllSettings saveCustomer(@RequestBody CustomerRequest req, @AuthenticationPrincipal Jwt jwt) {
        List<String> fields = req.requiredFields() == null ? List.of() : req.requiredFields().stream().distinct().toList();
        if (!CUSTOMER_FIELDS.containsAll(fields)) {
            throw BusinessException.badRequest("INVALID_FIELD", "Trường thông tin khách hàng không hợp lệ");
        }
        if (req.debtLimit() != null && req.debtLimit().signum() < 0) {
            throw BusinessException.badRequest("INVALID_DEBT_LIMIT", "Mức nợ cảnh báo không được âm");
        }
        store.write("customer", new ShopSettings.CustomerRules(fields, req.debtLimit()), userId(jwt));
        log(jwt, "Thiết lập cửa hàng", "Sửa", "Thiết lập khách hàng: bắt buộc " + fields
                + ", cảnh báo nợ " + (req.debtLimit() == null ? "Không" : req.debtLimit().toPlainString()));
        return all();
    }

    @PutMapping("/api/settings/lock")
    @PreAuthorize("hasAuthority('settings.manage')")
    public AllSettings saveLock(@RequestBody LockRequest req, @AuthenticationPrincipal Jwt jwt) {
        var branches = req.branches() == null ? java.util.Map.<UUID, java.time.LocalDate>of() : req.branches();
        if (branches.values().stream().anyMatch(d -> d == null || d.isAfter(java.time.LocalDate.now(ShopSettings.ZONE)))) {
            throw BusinessException.badRequest("INVALID_LOCK_DATE", "Ngày khóa sổ không được sau ngày hôm nay");
        }
        store.write("lock", new ShopSettings.BookLock(req.enabled(), branches), userId(jwt));
        log(jwt, "Thiết lập cửa hàng", "Sửa", "Khóa sổ: " + (req.enabled() ? "Bật " + branches : "Tắt"));
        return all();
    }

    private static String yes(boolean v) {
        return v ? "Có" : "Không";
    }

    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
