package com.vaxclinic.identity.auth.service;

import com.vaxclinic.identity.auth.controller.AuthController;
import com.vaxclinic.identity.auth.entity.RefreshToken;
import com.vaxclinic.identity.auth.repository.RefreshTokenRepository;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.auth.twofactor.service.TwoFactorService;
import com.vaxclinic.identity.user.entity.AppUser;
import com.vaxclinic.identity.user.repository.AppUserRepository;
import com.vaxclinic.identity.user.dto.UserDtos.UserResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Login / refresh / logout.
 * Refresh uses rotation: each refresh revokes the old token and issues a new one.
 * Re-use of a revoked token revokes every session of that user (token theft signal).
 */
@Service
public class AuthService {

    public record TokenPair(String accessToken, String refreshToken, long expiresIn) {
    }

    private static final BusinessException BAD_CREDENTIALS = new BusinessException(
            HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", "Sai tên đăng nhập hoặc mật khẩu");
    private static final BusinessException INVALID_REFRESH = new BusinessException(
            HttpStatus.UNAUTHORIZED, "INVALID_REFRESH_TOKEN", "Phiên đăng nhập đã hết hạn");

    private final AppUserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;
    private final Duration refreshTtl;
    private final TwoFactorService twoFactor;
    private final LoginAttemptLimiter loginAttempts;

    public AuthService(AppUserRepository users, RefreshTokenRepository refreshTokens, PasswordEncoder passwordEncoder,
                       TokenService tokenService, @Value("${app.jwt.refresh-ttl-days}") long refreshTtlDays,
                       TwoFactorService twoFactor, LoginAttemptLimiter loginAttempts) {
        this.twoFactor = twoFactor;
        this.loginAttempts = loginAttempts;
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
        this.refreshTtl = Duration.ofDays(refreshTtlDays);
    }

    /** totpCode: bắt buộc khi user đã bật xác thực 2 lớp (thiếu → 401 TOTP_REQUIRED để màn đăng nhập hiện ô nhập mã). */
    /** clientIp: giới hạn đăng nhập sai theo (tên đăng nhập, IP) — xem LoginAttemptLimiter. */
    @Transactional(noRollbackFor = BusinessException.class)
    public TokenPair login(String username, String password, String totpCode, String clientIp) {
        loginAttempts.checkAllowed(username, clientIp);
        AppUser user = users.findByUsernameIgnoreCase(username.trim()).orElse(null);
        if (user == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            loginAttempts.recordFailure(username, clientIp);
            throw BAD_CREDENTIALS;
        }
        if (!user.isActive()) {
            throw BusinessException.forbidden("USER_LOCKED", "Tài khoản đã bị khóa");
        }
        if (twoFactor.enabled(user.getId())) {
            twoFactor.checkLogin(user.getId(), totpCode); // thiếu / sai mã: không tính vào giới hạn mật khẩu
        }
        loginAttempts.recordSuccess(username, clientIp);
        return issue(user);
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public TokenPair refresh(String rawRefreshToken) {
        RefreshToken stored = refreshTokens.findByTokenHash(TokenService.sha256(rawRefreshToken))
                .orElseThrow(() -> INVALID_REFRESH);
        if (stored.isRevoked()) {
            refreshTokens.revokeAllForUser(stored.getUserId());
            throw INVALID_REFRESH;
        }
        if (stored.getExpiresAt().isBefore(Instant.now())) {
            throw INVALID_REFRESH;
        }
        stored.setRevoked(true);
        AppUser user = users.findById(stored.getUserId()).filter(AppUser::isActive).orElseThrow(() -> INVALID_REFRESH);
        return issue(user);
    }

    /** Hồ sơ user đang đăng nhập + quyền + trạng thái 2FA / chủ gian hàng (GET /api/auth/me). */
    @Transactional(readOnly = true)
    public AuthController.MeResponse me(UUID userId) {
        AppUser user = users.findById(userId)
                .orElseThrow(() -> BusinessException.notFound("USER_NOT_FOUND", "Không tìm thấy người dùng"));
        boolean twoFactorOn = twoFactor.enabled(user.getId());
        return new AuthController.MeResponse(UserResponse.of(user, twoFactorOn), List.copyOf(user.getRole().getPermissions()),
                twoFactorOn, user.isOwner());
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        refreshTokens.findByTokenHash(TokenService.sha256(rawRefreshToken)).ifPresent(t -> t.setRevoked(true));
    }

    private TokenPair issue(AppUser user) {
        String raw = tokenService.newRefreshToken();
        var rt = new RefreshToken();
        rt.setId(UUID.randomUUID());
        rt.setUserId(user.getId());
        rt.setTokenHash(TokenService.sha256(raw));
        rt.setExpiresAt(Instant.now().plus(refreshTtl));
        refreshTokens.save(rt);
        return new TokenPair(tokenService.issueAccessToken(user), raw, tokenService.accessTtlSeconds());
    }
}
