package com.vaxclinic.identity.auth.twofactor;

import com.vaxclinic.identity.auth.twofactor.TwoFactorService.Setup;
import com.vaxclinic.identity.auth.twofactor.TwoFactorService.Status;
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

/**
 * Xác thực 2 lớp của chính user đang đăng nhập (menu tài khoản → "Chưa bật xác thực 2 lớp").
 * Luồng: TwoFactorController → TwoFactorAccountService → TwoFactorService → UserTotpRepository / RecoveryCodeRepository.
 */
@RestController
@RequestMapping("/api/auth/2fa")
public class TwoFactorController {

    public record CodeRequest(String code) {
    }

    public record SecureRequest(String password, String code) {
    }

    private final TwoFactorAccountService service;

    public TwoFactorController(TwoFactorAccountService service) {
        this.service = service;
    }

    @GetMapping
    public Status status(@AuthenticationPrincipal Jwt jwt) {
        return service.status(userId(jwt));
    }

    @PostMapping("/setup")
    public Setup setup(@AuthenticationPrincipal Jwt jwt) {
        return service.setup(userId(jwt));
    }

    @PostMapping("/enable")
    public Map<String, List<String>> enable(@RequestBody CodeRequest req, @AuthenticationPrincipal Jwt jwt) {
        return Map.of("recoveryCodes", service.enable(userId(jwt), req.code()));
    }

    @PostMapping("/disable")
    public Status disable(@RequestBody SecureRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.disable(userId(jwt), req.password(), req.code());
    }

    @PostMapping("/recovery-codes")
    public Map<String, List<String>> recoveryCodes(@RequestBody SecureRequest req, @AuthenticationPrincipal Jwt jwt) {
        return Map.of("recoveryCodes", service.regenerateRecoveryCodes(userId(jwt), req.password(), req.code()));
    }

    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
