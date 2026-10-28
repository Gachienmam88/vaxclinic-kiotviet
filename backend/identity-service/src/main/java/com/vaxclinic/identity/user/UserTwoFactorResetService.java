package com.vaxclinic.identity.user;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.auth.RefreshTokenRepository;
import com.vaxclinic.identity.auth.twofactor.TwoFactorService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Quản trị viên (quyền user.manage) đặt lại xác thực 2 lớp cho user khác khi họ mất điện thoại và mã khôi phục.
 * Quy tắc: không tự đặt lại cho mình (dùng Tài khoản → Xác thực 2 lớp); 2FA của chủ gian hàng chỉ chủ gian hàng tự xử lý;
 * người thao tác xác nhận bằng mật khẩu của chính mình (hoặc mã Authenticator nếu họ đã bật 2FA).
 * Kết quả: xóa khóa TOTP + mã khôi phục của user đích và thu hồi mọi refresh token (đăng xuất ở lần làm mới phiên kế tiếp).
 */
@Service
public class UserTwoFactorResetService {

    private final AppUserRepository users;
    private final TwoFactorService twoFactor;
    private final RefreshTokenRepository refreshTokens;

    public UserTwoFactorResetService(AppUserRepository users, TwoFactorService twoFactor, RefreshTokenRepository refreshTokens) {
        this.users = users;
        this.twoFactor = twoFactor;
        this.refreshTokens = refreshTokens;
    }

    /** Trả về user đích (để ghi lịch sử thao tác). */
    @Transactional
    public AppUser reset(UUID targetId, UUID actorId, String password, String code) {
        if (targetId.equals(actorId)) {
            throw BusinessException.badRequest("CANNOT_RESET_SELF",
                    "Không thể tự đặt lại xác thực 2 lớp của mình. Dùng Tài khoản → Xác thực 2 lớp");
        }
        AppUser target = find(targetId);
        AppUser actor = find(actorId);
        if (target.isOwner()) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "OWNER_PROTECTED",
                    "Chỉ chủ gian hàng được tự đặt lại xác thực 2 lớp của mình");
        }
        if (!twoFactor.enabled(targetId)) {
            throw BusinessException.badRequest("TOTP_NOT_ENABLED", "Người dùng này chưa bật xác thực 2 lớp");
        }
        twoFactor.confirmIdentity(actor, password, code);
        twoFactor.reset(targetId);
        refreshTokens.revokeAllForUser(targetId);
        return target;
    }

    private AppUser find(UUID id) {
        return users.findById(id)
                .orElseThrow(() -> BusinessException.notFound("USER_NOT_FOUND", "Không tìm thấy người dùng"));
    }
}
