package com.vaxclinic.identity.storeprofile;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.identity.auth.RefreshTokenRepository;
import com.vaxclinic.identity.settings.SettingsController.StoreInfo;
import com.vaxclinic.identity.settings.SettingsStore;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.SessionCutoff;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.StorePause;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.UserRef;
import com.vaxclinic.identity.user.AppUser;
import com.vaxclinic.identity.user.AppUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;

/**
 * Thao tác chỉ chủ gian hàng được làm: đổi tên gian hàng (địa chỉ truy cập), chuyển nhượng, bảo lưu / mở lại.
 * Luôn có đúng 1 chủ gian hàng (chỉ mục duy nhất uq_users_single_owner); thiếu → gán cho ADMIN đang hoạt động lâu nhất.
 */
@Service
public class StoreOwnershipService {

    private static final Logger log = LoggerFactory.getLogger(StoreOwnershipService.class);
    static final int MAX_PAUSE_DAYS = 60;
    private static final DateTimeFormatter DMY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final StoreProfileService profile;
    private final SettingsStore store;
    private final AppUserRepository users;
    private final RefreshTokenRepository refreshTokens;

    public StoreOwnershipService(StoreProfileService profile, SettingsStore store, AppUserRepository users,
                                 RefreshTokenRepository refreshTokens) {
        this.profile = profile;
        this.store = store;
        this.users = users;
        this.refreshTokens = refreshTokens;
    }

    /** Chạy sau IdentityBootstrap (tạo admin đầu tiên): DB mới chưa có chủ gian hàng thì gán. */
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void ensureOwner() {
        if (users.findFirstByOwnerTrue().isPresent()) {
            return;
        }
        users.findAll().stream().filter(u -> u.isActive() && "ADMIN".equals(u.getRole().getCode()))
                .min(Comparator.comparing(AppUser::getCreatedAt)).ifPresent(u -> {
                    u.setOwner(true);
                    log.info("Assigned store owner to '{}'", u.getUsername());
                });
    }

    /** Đổi địa chỉ truy cập + đăng xuất mọi thiết bị (thu hồi refresh token, gateway từ chối access token cũ). */
    @Transactional
    public void rename(String newCode, AppUser owner) {
        String current = profile.currentAccessCode();
        if (current.equalsIgnoreCase(newCode)) {
            throw BusinessException.badRequest("SAME_ACCESS_CODE", "Tên gian hàng mới phải khác tên hiện tại");
        }
        StoreInfo s = profile.storeInfo();
        store.write("store", new StoreInfo(s.name(), s.phone(), s.email(), s.address(), s.province(), s.ward(), s.taxCode(),
                s.logo(), newCode, s.provinceCode(), s.wardCode()), owner.getId());
        store.write(StoreStatusService.CUTOFF_KEY, new SessionCutoff(Instant.now().getEpochSecond() + 1), owner.getId());
        int revoked = refreshTokens.revokeAll();
        profile.log(owner, "Đổi tên gian hàng: " + current + " → " + newCode + " (đăng xuất " + revoked + " phiên)");
    }

    /** Người nhận: ADMIN đang hoạt động khác chủ hiện tại. */
    public List<UserRef> transferCandidates() {
        return users.findAll().stream().filter(u -> u.isActive() && !u.isOwner() && "ADMIN".equals(u.getRole().getCode()))
                .sorted(Comparator.comparing(AppUser::getUsername))
                .map(u -> new UserRef(u.getId(), u.getUsername(), u.getFullName())).toList();
    }

    @Transactional
    public void transfer(AppUser owner, AppUser target) {
        if (target.getId().equals(owner.getId()) || !target.isActive() || !"ADMIN".equals(target.getRole().getCode())) {
            throw BusinessException.badRequest("INVALID_NEW_OWNER", "Người nhận phải là quản trị viên khác đang hoạt động");
        }
        owner.setOwner(false);
        users.saveAndFlush(owner); // bỏ cờ trước để không vi phạm chỉ mục duy nhất
        target.setOwner(true);
        users.save(target);
        profile.log(owner, "Chuyển nhượng gian hàng: " + owner.getUsername() + " → " + target.getUsername());
    }

    @Transactional
    public void pause(LocalDate reopenOn, AppUser owner) {
        LocalDate today = LocalDate.now(ShopSettings.ZONE);
        if (store.read(StoreStatusService.PAUSE_KEY, StorePause.class) != null) {
            throw BusinessException.conflict("PAUSE_USED", "Gian hàng chỉ được bảo lưu một lần duy nhất");
        }
        if (!reopenOn.isAfter(today) || reopenOn.isAfter(today.plusDays(MAX_PAUSE_DAYS))) {
            throw BusinessException.badRequest("INVALID_PAUSE_DATE",
                    "Ngày mở lại phải sau hôm nay và không quá " + MAX_PAUSE_DAYS + " ngày (tối đa 2 tháng)");
        }
        store.write(StoreStatusService.PAUSE_KEY, new StorePause(today, reopenOn, null, owner.getId()), owner.getId());
        profile.log(owner, "Bảo lưu gian hàng từ " + today.format(DMY) + ", tự mở lại ngày " + reopenOn.format(DMY));
    }

    @Transactional
    public void reopen(AppUser owner) {
        StorePause p = store.read(StoreStatusService.PAUSE_KEY, StorePause.class);
        if (!StoreStatusService.isPaused(p, LocalDate.now(ShopSettings.ZONE))) {
            throw BusinessException.badRequest("NOT_PAUSED", "Gian hàng không trong thời gian bảo lưu");
        }
        store.write(StoreStatusService.PAUSE_KEY, new StorePause(p.pausedOn(), p.reopenOn(), Instant.now(), p.pausedBy()), owner.getId());
        profile.log(owner, "Mở lại gian hàng trước hạn (bảo lưu đến " + p.reopenOn().format(DMY) + ")");
    }
}
