package com.vaxclinic.identity.auth.twofactor;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.auth.twofactor.TwoFactorService.Setup;
import com.vaxclinic.identity.auth.twofactor.TwoFactorService.Status;
import com.vaxclinic.identity.settings.SettingsController.StoreInfo;
import com.vaxclinic.identity.settings.SettingsStore;
import com.vaxclinic.identity.user.AppUser;
import com.vaxclinic.identity.user.AppUserRepository;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Xác thực 2 lớp của chính user đang đăng nhập (menu tài khoản → "Chưa bật xác thực 2 lớp"). */
@RestController
@RequestMapping("/api/auth/2fa")
public class TwoFactorController {

    public record CodeRequest(String code) {
    }

    public record SecureRequest(String password, String code) {
    }

    private static final String FEATURE = "Tài khoản";

    private final TwoFactorService service;
    private final AppUserRepository users;
    private final SettingsStore settings;
    private final AuditLogger audit;

    public TwoFactorController(TwoFactorService service, AppUserRepository users, SettingsStore settings, AuditLogger audit) {
        this.service = service;
        this.users = users;
        this.settings = settings;
        this.audit = audit;
    }

    @GetMapping
    public Status status(@AuthenticationPrincipal Jwt jwt) {
        return service.status(userId(jwt));
    }

    @PostMapping("/setup")
    public Setup setup(@AuthenticationPrincipal Jwt jwt) {
        StoreInfo store = settings.read("store", StoreInfo.class);
        return service.setup(user(jwt), store == null || store.name() == null ? "VaxClinic" : store.name());
    }

    @PostMapping("/enable")
    public Map<String, List<String>> enable(@RequestBody CodeRequest req, @AuthenticationPrincipal Jwt jwt) {
        List<String> codes = service.enable(userId(jwt), req.code());
        log(jwt, "Bật xác thực 2 lớp");
        return Map.of("recoveryCodes", codes);
    }

    @PostMapping("/disable")
    public Status disable(@RequestBody SecureRequest req, @AuthenticationPrincipal Jwt jwt) {
        service.disable(user(jwt), req.password(), req.code());
        log(jwt, "Tắt xác thực 2 lớp");
        return service.status(userId(jwt));
    }

    @PostMapping("/recovery-codes")
    public Map<String, List<String>> recoveryCodes(@RequestBody SecureRequest req, @AuthenticationPrincipal Jwt jwt) {
        List<String> codes = service.regenerateRecoveryCodes(user(jwt), req.password(), req.code());
        log(jwt, "Tạo lại mã khôi phục 2 lớp");
        return Map.of("recoveryCodes", codes);
    }

    private void log(Jwt jwt, String detail) {
        audit.record(userId(jwt), jwt.getClaimAsString("name"), null, FEATURE, "Sửa", null, detail);
    }

    private AppUser user(Jwt jwt) {
        return users.findById(userId(jwt)).orElseThrow(() -> BusinessException.notFound("USER_NOT_FOUND", "Không tìm thấy người dùng"));
    }

    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
