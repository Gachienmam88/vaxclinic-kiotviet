package com.vaxclinic.identity.storeprofile;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.user.AppUser;
import com.vaxclinic.identity.user.AppUserRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Quy tắc truy cập Hồ sơ cửa hàng (dùng chung cho các service của gói):
 * - manager: chủ gian hàng hoặc người có quyền settings.manage — xem, cập nhật hồ sơ, số điện thoại;
 * - owner: chỉ chủ gian hàng — đổi tên, chuyển nhượng, bảo lưu, mở lại.
 */
@Service
public class StoreProfileAccess {

    private final AppUserRepository users;

    public StoreProfileAccess(AppUserRepository users) {
        this.users = users;
    }

    public AppUser requireManager(UUID userId, List<String> permissions) {
        AppUser u = user(userId);
        if (!u.isOwner() && (permissions == null || !permissions.contains("settings.manage"))) {
            throw BusinessException.forbidden("FORBIDDEN",
                    "Chỉ chủ gian hàng hoặc người có quyền thiết lập được xem hồ sơ cửa hàng");
        }
        return u;
    }

    public AppUser requireOwner(UUID userId) {
        AppUser u = user(userId);
        if (!u.isOwner()) {
            throw BusinessException.forbidden("OWNER_ONLY", "Chỉ chủ gian hàng được thực hiện thao tác này");
        }
        return u;
    }

    public AppUser user(UUID id) {
        return users.findById(id).orElseThrow(() -> BusinessException.notFound("USER_NOT_FOUND", "Không tìm thấy người dùng"));
    }
}
