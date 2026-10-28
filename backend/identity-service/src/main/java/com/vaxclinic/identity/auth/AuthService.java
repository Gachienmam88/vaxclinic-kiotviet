package com.vaxclinic.identity.auth;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.user.AppUser;
import com.vaxclinic.identity.user.AppUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
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

    public AuthService(AppUserRepository users, RefreshTokenRepository refreshTokens, PasswordEncoder passwordEncoder,
                       TokenService tokenService, @Value("${app.jwt.refresh-ttl-days}") long refreshTtlDays) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
        this.refreshTtl = Duration.ofDays(refreshTtlDays);
    }

    @Transactional
    public TokenPair login(String username, String password) {
        AppUser user = users.findByUsernameIgnoreCase(username.trim()).orElseThrow(() -> BAD_CREDENTIALS);
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw BAD_CREDENTIALS;
        }
        if (!user.isActive()) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "USER_LOCKED", "Tài khoản đã bị khóa");
        }
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
