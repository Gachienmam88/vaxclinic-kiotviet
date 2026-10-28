package com.vaxclinic.identity.auth.twofactor;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.auth.twofactor.TwoFactorService.Setup;
import com.vaxclinic.identity.auth.twofactor.TwoFactorService.Status;
import com.vaxclinic.identity.settings.SettingsController.StoreInfo;
import com.vaxclinic.identity.settings.SettingsStore;
import com.vaxclinic.identity.user.AppUser;
import com.vaxclinic.identity.user.AppUserRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Nghiệp vụ "Tài khoản → Xác thực 2 lớp" của chính user đang đăng nhập (TwoFactorController gọi vào đây):
 * tải user, lấy tên cửa hàng làm issuer trong ứng dụng Authenticator, gọi {@link TwoFactorService}, ghi Lịch sử thao tác.
 */
@Service
public class TwoFactorAccountService {

    private static final String FEATURE = "Tài khoản";

    private final TwoFactorService twoFactor;
    private final AppUserRepository users;
    private final SettingsStore settings;
    private final AuditLogger audit;

    public TwoFactorAccountService(TwoFactorService twoFactor, AppUserRepository users, SettingsStore settings, AuditLogger audit) {
        this.twoFactor = twoFactor;
        this.users = users;
        this.settings = settings;
        this.audit = audit;
    }

    public Status status(UUID userId) {
        return twoFactor.status(userId);
    }

    public Setup setup(UUID userId) {
        StoreInfo store = settings.read("store", StoreInfo.class);
        return twoFactor.setup(user(userId), store == null || store.name() == null ? "VaxClinic" : store.name());
    }

    public List<String> enable(UUID userId, String code) {
        List<String> codes = twoFactor.enable(userId, code);
        log(userId, "Bật xác thực 2 lớp");
        return codes;
    }

    public Status disable(UUID userId, String password, String code) {
        twoFactor.disable(user(userId), password, code);
        log(userId, "Tắt xác thực 2 lớp");
        return twoFactor.status(userId);
    }

    public List<String> regenerateRecoveryCodes(UUID userId, String password, String code) {
        List<String> codes = twoFactor.regenerateRecoveryCodes(user(userId), password, code);
        log(userId, "Tạo lại mã khôi phục 2 lớp");
        return codes;
    }

    private void log(UUID userId, String detail) {
        audit.record(userId, user(userId).getFullName(), null, FEATURE, "Sửa", null, detail);
    }

    private AppUser user(UUID id) {
        return users.findById(id).orElseThrow(() -> BusinessException.notFound("USER_NOT_FOUND", "Không tìm thấy người dùng"));
    }
}
