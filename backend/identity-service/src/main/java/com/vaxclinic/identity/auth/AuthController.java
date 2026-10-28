package com.vaxclinic.identity.auth;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.auth.AuthService.TokenPair;
import com.vaxclinic.identity.user.AppUserRepository;
import com.vaxclinic.identity.user.UserDtos.UserResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
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
    private final AppUserRepository users;

    public AuthController(AuthService authService, AppUserRepository users) {
        this.authService = authService;
        this.users = users;
    }

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {
    }

    public record RefreshRequest(@NotBlank String refreshToken) {
    }

    /** Current user profile + permissions; the frontend builds menus from this. */
    public record MeResponse(UserResponse user, List<String> permissions) {
    }

    @PostMapping("/login")
    public TokenPair login(@Valid @RequestBody LoginRequest req) {
        return authService.login(req.username(), req.password());
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
    @Transactional(readOnly = true)
    public MeResponse me(@AuthenticationPrincipal Jwt jwt) {
        var user = users.findById(UUID.fromString(jwt.getSubject()))
                .orElseThrow(() -> BusinessException.notFound("USER_NOT_FOUND", "Không tìm thấy người dùng"));
        return new MeResponse(UserResponse.of(user), List.copyOf(user.getRole().getPermissions()));
    }
}
