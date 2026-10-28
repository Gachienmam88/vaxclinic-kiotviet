package com.vaxclinic.identity.storeprofile;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.PauseRequest;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.PhoneRequest;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.ProfileRequest;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.ProfileView;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.RenameRequest;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.TransferRequest;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.UserRef;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.VerifyRequest;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.VerifyResponse;
import com.vaxclinic.identity.user.AppUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Hồ sơ cửa hàng (menu tài khoản). Xem + cập nhật hồ sơ / số điện thoại: chủ gian hàng hoặc quyền settings.manage.
 * Đổi tên, chuyển nhượng, bảo lưu, mở lại: chỉ chủ gian hàng. Thao tác ghi cần phiếu xác thực (POST /verify).
 * Khi gian hàng bảo lưu, gateway vẫn cho qua /api/store-profile/** (để mở lại được).
 */
@RestController
@RequestMapping("/api/store-profile")
public class StoreProfileController {

    public record HistoryItem(long id, java.time.Instant occurredAt, String userName, String detail) {
    }

    private final StoreProfileService profile;
    private final StoreOwnershipService ownership;
    private final StoreActionVerifier verifier;
    private final JdbcTemplate jdbc;

    public StoreProfileController(StoreProfileService profile, StoreOwnershipService ownership, StoreActionVerifier verifier,
                                  JdbcTemplate jdbc) {
        this.profile = profile;
        this.ownership = ownership;
        this.verifier = verifier;
        this.jdbc = jdbc;
    }

    @GetMapping
    public ProfileView view(@AuthenticationPrincipal Jwt jwt) {
        return profile.view(manager(jwt));
    }

    @PostMapping("/verify")
    public VerifyResponse verify(@Valid @RequestBody VerifyRequest r, @AuthenticationPrincipal Jwt jwt) {
        AppUser u = List.of("RENAME", "TRANSFER", "PAUSE").contains(r.purpose()) ? owner(jwt) : manager(jwt);
        return verifier.issue(u, r.purpose(), r.password(), r.code());
    }

    @PutMapping("/profile")
    public ProfileView updateProfile(@Valid @RequestBody ProfileRequest r, @AuthenticationPrincipal Jwt jwt) {
        AppUser u = manager(jwt);
        verifier.check(u.getId(), "PROFILE", r.verifyToken());
        profile.updateProfile(r, u);
        return profile.view(u);
    }

    @PutMapping("/phone")
    public ProfileView updatePhone(@Valid @RequestBody PhoneRequest r, @AuthenticationPrincipal Jwt jwt) {
        AppUser u = manager(jwt);
        verifier.check(u.getId(), "PHONE", r.verifyToken());
        profile.updatePhone(r, u);
        return profile.view(u);
    }

    /** Sau khi đổi: mọi phiên (kể cả phiên hiện tại) bị đăng xuất; trả địa chỉ mới để màn hình chuyển về trang đăng nhập. */
    @PutMapping("/access-code")
    public Map<String, String> rename(@Valid @RequestBody RenameRequest r, @AuthenticationPrincipal Jwt jwt) {
        AppUser u = owner(jwt);
        verifier.check(u.getId(), "RENAME", r.verifyToken());
        ownership.rename(r.accessCode(), u);
        return Map.of("accessCode", r.accessCode());
    }

    @GetMapping("/transfer-candidates")
    public List<UserRef> candidates(@AuthenticationPrincipal Jwt jwt) {
        owner(jwt);
        return ownership.transferCandidates();
    }

    @PostMapping("/transfer")
    public ProfileView transfer(@Valid @RequestBody TransferRequest r, @AuthenticationPrincipal Jwt jwt) {
        AppUser u = owner(jwt);
        verifier.check(u.getId(), "TRANSFER", r.verifyToken());
        ownership.transfer(u, profile.user(r.targetUserId()));
        return profile.view(profile.user(u.getId()));
    }

    @PostMapping("/pause")
    public ProfileView pause(@Valid @RequestBody PauseRequest r, @AuthenticationPrincipal Jwt jwt) {
        AppUser u = owner(jwt);
        verifier.check(u.getId(), "PAUSE", r.verifyToken());
        ownership.pause(r.reopenOn(), u);
        return profile.view(u);
    }

    @PostMapping("/reopen")
    public ProfileView reopen(@AuthenticationPrincipal Jwt jwt) {
        AppUser u = owner(jwt);
        ownership.reopen(u);
        return profile.view(u);
    }

    /** Tab "Lịch sử cập nhật": Lịch sử thao tác của tính năng Hồ sơ cửa hàng. */
    @GetMapping("/history")
    public PageResponse<HistoryItem> history(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                             @AuthenticationPrincipal Jwt jwt) {
        manager(jwt);
        int s = Math.min(Math.max(size, 1), 100);
        Long total = jdbc.queryForObject("select count(*) from audit_logs where feature = ?", Long.class, StoreProfileService.FEATURE);
        List<HistoryItem> items = jdbc.query("select id, occurred_at, user_name, detail from audit_logs where feature = ?"
                        + " order by occurred_at desc, id desc limit ? offset ?",
                (rs, n) -> new HistoryItem(rs.getLong(1), rs.getTimestamp(2).toInstant(), rs.getString(3), rs.getString(4)),
                StoreProfileService.FEATURE, s, (long) Math.max(page, 0) * s);
        return new PageResponse<>(items, total == null ? 0 : total, Math.max(page, 0), s);
    }

    private AppUser manager(Jwt jwt) {
        AppUser u = profile.user(UUID.fromString(jwt.getSubject()));
        List<String> perms = jwt.getClaimAsStringList("perms");
        if (!u.isOwner() && (perms == null || !perms.contains("settings.manage"))) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Chỉ chủ gian hàng hoặc người có quyền thiết lập được xem hồ sơ cửa hàng");
        }
        return u;
    }

    private AppUser owner(Jwt jwt) {
        AppUser u = profile.user(UUID.fromString(jwt.getSubject()));
        if (!u.isOwner()) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "OWNER_ONLY", "Chỉ chủ gian hàng được thực hiện thao tác này");
        }
        return u;
    }
}
