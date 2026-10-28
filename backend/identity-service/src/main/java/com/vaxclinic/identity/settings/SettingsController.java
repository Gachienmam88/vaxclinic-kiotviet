package com.vaxclinic.identity.settings;

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

    /** Thông tin cửa hàng: dùng cho đầu mẫu in. logo: ảnh data URL đã thu nhỏ phía trình duyệt. */
    public record StoreInfo(@NotBlank @Size(max = 200) String name, @Size(max = 20) String phone,
                            @Email @Size(max = 150) String email, @Size(max = 500) String address,
                            @Size(max = 100) String province, @Size(max = 100) String ward,
                            @Size(max = 20) String taxCode, @Size(max = 400_000) String logo) {
    }

    public record SalesRequest(boolean allowNegativeStock, boolean blockEditPublishedEInvoice,
                               boolean lockTransactionTime, @Min(1) @Max(3650) Integer returnLimitDays) {
    }

    public record CustomerRequest(List<String> requiredFields, BigDecimal debtLimit) {
    }

    public record LockRequest(boolean enabled, java.util.Map<UUID, java.time.LocalDate> branches) {
    }

    public record AllSettings(StoreInfo store, ShopSettings.Sales sales, ShopSettings.CustomerRules customer,
                              ShopSettings.BookLock lock) {
    }

    private final SettingsStore store;

    public SettingsController(SettingsStore store) {
        this.store = store;
    }

    @GetMapping("/api/settings")
    public AllSettings all() {
        ShopSettings s = store.shop();
        return new AllSettings(store.read("store", StoreInfo.class), s.sales(), s.customer(), s.lock());
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
        store.write("store", req, userId(jwt));
        return all();
    }

    @PutMapping("/api/settings/sales")
    @PreAuthorize("hasAuthority('settings.manage')")
    public AllSettings saveSales(@Valid @RequestBody SalesRequest req, @AuthenticationPrincipal Jwt jwt) {
        store.write("sales", new ShopSettings.Sales(req.allowNegativeStock(), req.blockEditPublishedEInvoice(),
                req.lockTransactionTime(), req.returnLimitDays()), userId(jwt));
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
        return all();
    }

    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
