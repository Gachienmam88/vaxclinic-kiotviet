package com.vaxclinic.identity.storeprofile.controller;

import com.vaxclinic.identity.storeprofile.service.StoreOwnershipService;
import com.vaxclinic.identity.storeprofile.service.StoreProfileService;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.identity.storeprofile.repository.StoreProfileHistoryRepository.HistoryItem;
import com.vaxclinic.identity.storeprofile.dto.StoreProfileModels.PauseRequest;
import com.vaxclinic.identity.storeprofile.dto.StoreProfileModels.PhoneRequest;
import com.vaxclinic.identity.storeprofile.dto.StoreProfileModels.ProfileRequest;
import com.vaxclinic.identity.storeprofile.dto.StoreProfileModels.ProfileView;
import com.vaxclinic.identity.storeprofile.dto.StoreProfileModels.RenameRequest;
import com.vaxclinic.identity.storeprofile.dto.StoreProfileModels.TransferRequest;
import com.vaxclinic.identity.storeprofile.dto.StoreProfileModels.UserRef;
import com.vaxclinic.identity.storeprofile.dto.StoreProfileModels.VerifyRequest;
import com.vaxclinic.identity.storeprofile.dto.StoreProfileModels.VerifyResponse;
import jakarta.validation.Valid;
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
 * Hồ sơ cửa hàng (menu tài khoản). Controller chỉ nhận request, kiểm tra dữ liệu (@Valid) rồi chuyển cho service:
 * - xem / xác thực / hồ sơ / số điện thoại / lịch sử → {@link StoreProfileService};
 * - đổi tên / chuyển nhượng / bảo lưu / mở lại → {@link StoreOwnershipService}.
 * Quyền (chủ gian hàng / settings.manage) và phiếu xác thực được kiểm tra trong service. Khi gian hàng bảo lưu, gateway
 * vẫn cho qua /api/store-profile/** (để mở lại được).
 */
@RestController
@RequestMapping("/api/store-profile")
public class StoreProfileController {

    private final StoreProfileService profile;
    private final StoreOwnershipService ownership;

    public StoreProfileController(StoreProfileService profile, StoreOwnershipService ownership) {
        this.profile = profile;
        this.ownership = ownership;
    }

    @GetMapping
    public ProfileView view(@AuthenticationPrincipal Jwt jwt) {
        return profile.view(userId(jwt), perms(jwt));
    }

    @PostMapping("/verify")
    public VerifyResponse verify(@Valid @RequestBody VerifyRequest r, @AuthenticationPrincipal Jwt jwt) {
        return profile.verify(userId(jwt), perms(jwt), r);
    }

    @PutMapping("/profile")
    public ProfileView updateProfile(@Valid @RequestBody ProfileRequest r, @AuthenticationPrincipal Jwt jwt) {
        return profile.updateProfile(userId(jwt), perms(jwt), r);
    }

    @PutMapping("/phone")
    public ProfileView updatePhone(@Valid @RequestBody PhoneRequest r, @AuthenticationPrincipal Jwt jwt) {
        return profile.updatePhone(userId(jwt), perms(jwt), r);
    }

    @GetMapping("/history")
    public PageResponse<HistoryItem> history(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                             @AuthenticationPrincipal Jwt jwt) {
        return profile.history(userId(jwt), perms(jwt), page, size);
    }

    /** Sau khi đổi: mọi phiên (kể cả phiên hiện tại) bị đăng xuất; trả địa chỉ mới để màn hình chuyển về trang đăng nhập. */
    @PutMapping("/access-code")
    public Map<String, String> rename(@Valid @RequestBody RenameRequest r, @AuthenticationPrincipal Jwt jwt) {
        return Map.of("accessCode", ownership.rename(userId(jwt), r));
    }

    @GetMapping("/transfer-candidates")
    public List<UserRef> candidates(@AuthenticationPrincipal Jwt jwt) {
        return ownership.transferCandidates(userId(jwt));
    }

    @PostMapping("/transfer")
    public ProfileView transfer(@Valid @RequestBody TransferRequest r, @AuthenticationPrincipal Jwt jwt) {
        return ownership.transfer(userId(jwt), r);
    }

    @PostMapping("/pause")
    public ProfileView pause(@Valid @RequestBody PauseRequest r, @AuthenticationPrincipal Jwt jwt) {
        return ownership.pause(userId(jwt), r);
    }

    @PostMapping("/reopen")
    public ProfileView reopen(@AuthenticationPrincipal Jwt jwt) {
        return ownership.reopen(userId(jwt));
    }

    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    private static List<String> perms(Jwt jwt) {
        return jwt.getClaimAsStringList("perms");
    }
}
