package com.vaxclinic.identity.user.service;

import com.vaxclinic.identity.user.entity.AppUser;
import com.vaxclinic.identity.user.repository.AppUserRepository;
import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.identity.auth.repository.RefreshTokenRepository;
import com.vaxclinic.identity.auth.twofactor.service.TwoFactorService;
import com.vaxclinic.identity.notification.service.NotificationWriter;
import com.vaxclinic.identity.user.dto.UserDtos.Actor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * Quản trị viên (quyền user.manage) đặt lại xác thực 2 lớp cho user khác khi họ mất điện thoại và mã khôi phục.
 * Quy tắc:
 * - không tự đặt lại cho mình (dùng Tài khoản → Xác thực 2 lớp);
 * - 2FA của chủ gian hàng chỉ chủ gian hàng tự xử lý;
 * - chỉ người có vai trò ADMIN được đặt lại cho user vai trò ADMIN (người chỉ có quyền user.manage → 403 ADMIN_PROTECTED);
 * - người thao tác xác nhận bằng mật khẩu của chính mình (hoặc mã Authenticator nếu họ đã bật 2FA).
 * Kết quả: xóa khóa TOTP + mã khôi phục của user đích, thu hồi mọi refresh token, gửi cảnh báo riêng cho user đó và ghi
 * Lịch sử thao tác.
 */
@Service
public class UserTwoFactorResetService {

    static final String NOTIFICATION_TYPE = "TWO_FACTOR_RESET";
    private static final DateTimeFormatter AT = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");

    private final AppUserRepository users;
    private final TwoFactorService twoFactor;
    private final RefreshTokenRepository refreshTokens;
    private final NotificationWriter notifications;
    private final AuditLogger audit;

    public UserTwoFactorResetService(AppUserRepository users, TwoFactorService twoFactor, RefreshTokenRepository refreshTokens,
                                     NotificationWriter notifications, AuditLogger audit) {
        this.users = users;
        this.twoFactor = twoFactor;
        this.refreshTokens = refreshTokens;
        this.notifications = notifications;
        this.audit = audit;
    }

    @Transactional
    public void reset(UUID targetId, Actor actorRef, String password, String code) {
        if (targetId.equals(actorRef.id())) {
            throw BusinessException.badRequest("CANNOT_RESET_SELF",
                    "Không thể tự đặt lại xác thực 2 lớp của mình. Dùng Tài khoản → Xác thực 2 lớp");
        }
        AppUser target = find(targetId);
        AppUser actor = find(actorRef.id());
        if (target.isOwner()) {
            throw BusinessException.forbidden("OWNER_PROTECTED",
                    "Chỉ chủ gian hàng được tự đặt lại xác thực 2 lớp của mình");
        }
        if (isAdmin(target) && !isAdmin(actor)) {
            throw BusinessException.forbidden("ADMIN_PROTECTED",
                    "Chỉ quản trị viên (vai trò Quản trị hệ thống) được đặt lại xác thực 2 lớp của quản trị viên khác");
        }
        if (!twoFactor.enabled(targetId)) {
            throw BusinessException.badRequest("TOTP_NOT_ENABLED", "Người dùng này chưa bật xác thực 2 lớp");
        }
        twoFactor.confirmIdentity(actor, password, code);
        twoFactor.reset(targetId);
        refreshTokens.revokeAllForUser(targetId);
        notifications.insertForUser(targetId, NOTIFICATION_TYPE, "Xác thực 2 lớp của bạn đã được đặt lại",
                "Quản trị viên " + actor.getFullName() + " (" + actor.getUsername() + ") đã đặt lại xác thực 2 lớp của bạn lúc "
                        + ZonedDateTime.now(ShopSettings.ZONE).format(AT) + ". Bạn có thể bật lại tại Tài khoản → Xác thực 2 lớp."
                        + " Nếu bạn không yêu cầu việc này, hãy báo ngay cho chủ gian hàng.", null);
        audit.record(actor.getId(), actor.getFullName(), null, "Người dùng", "Đặt lại xác thực 2 lớp", null,
                "Đặt lại xác thực 2 lớp tài khoản " + target.getUsername());
    }

    private static boolean isAdmin(AppUser u) {
        return "ADMIN".equals(u.getRole().getCode());
    }

    private AppUser find(UUID id) {
        return users.findById(id)
                .orElseThrow(() -> BusinessException.notFound("USER_NOT_FOUND", "Không tìm thấy người dùng"));
    }
}
