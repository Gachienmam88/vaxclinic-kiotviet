package com.vaxclinic.identity.auth;

import com.vaxclinic.identity.auth.AuthService.TokenPair;
import com.vaxclinic.identity.user.UserDtos.UserResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /** code: mã xác thực 2 lớp (TOTP 6 số hoặc mã khôi phục), chỉ cần khi user đã bật. */
    public record LoginRequest(@NotBlank String username, @NotBlank String password, String code) {
    }

    public record RefreshRequest(@NotBlank String refreshToken) {
    }

    /**
     * Current user profile + permissions; the frontend builds menus from this.
     * twoFactorEnabled: đã bật xác thực 2 lớp; storeOwner: là chủ gian hàng.
     */
    public record MeResponse(UserResponse user, List<String> permissions, boolean twoFactorEnabled, boolean storeOwner) {
    }

    @PostMapping("/login")
    public TokenPair login(@Valid @RequestBody LoginRequest req, HttpServletRequest http) {
        return authService.login(req.username(), req.password(), req.code(), ClientIpResolver.resolve(http));
    }

    @PostMapping("/refresh")
    public TokenPair refresh(@Valid @RequestBody RefreshRequest req) {
        return authService.refresh(req.refreshToken());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody RefreshRequest req) {
        authService.logout(req.refreshToken());
    }

    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal Jwt jwt) {
        return authService.me(UUID.fromString(jwt.getSubject()));
    }
}
