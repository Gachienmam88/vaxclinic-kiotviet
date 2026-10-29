package com.vaxclinic.identity.role;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.role.RoleModels.RoleRequest;
import com.vaxclinic.identity.role.RoleModels.RoleResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Nghiệp vụ vai trò: ADMIN luôn đủ mọi quyền (chỉ đổi tên / mô tả), vai trò hệ thống không xóa được, vai trò đang gán
 * cho tài khoản không xóa được. Mỗi thay đổi ghi Lịch sử thao tác tính năng "Người dùng".
 */
@Service
public class RoleService {

    private static final String FEATURE = "Người dùng";

    private final RoleRepository roles;
    private final RoleUserRepository roleUsers;
    private final AuditLogger audit;

    public RoleService(RoleRepository roles, RoleUserRepository roleUsers, AuditLogger audit) {
        this.roles = roles;
        this.roleUsers = roleUsers;
        this.audit = audit;
    }

    /** Vai trò hệ thống trước, rồi theo tên; kèm tài khoản đang hoạt động. */
    public List<RoleResponse> list() {
        var users = roleUsers.activeUsernamesByRole();
        return roles.findAll().stream().sorted(Comparator.comparing(Role::isSystem).reversed().thenComparing(Role::getName))
                .map(r -> new RoleResponse(r.getId(), r.getCode(), r.getName(), r.getDescription(), r.isSystem(),
                        r.getPermissions(), users.getOrDefault(r.getId(), List.of())))
                .toList();
    }

    @Transactional
    public RoleResponse create(RoleRequest req, UUID userId, String userName) {
        var r = new Role();
        r.setId(UUID.randomUUID());
        r.setCode("CUSTOM_" + r.getId().toString().substring(0, 8).toUpperCase());
        r.setSystem(false);
        apply(r, req);
        roles.save(r);
        audit.record(userId, userName, null, FEATURE, "Tạo vai trò", null, "Tạo vai trò " + r.getName() + ", quyền " + r.getPermissions());
        return find(r.getId());
    }

    @Transactional
    public RoleResponse update(UUID id, RoleRequest req, UUID userId, String userName) {
        Role r = load(id);
        if ("ADMIN".equals(r.getCode())) {
            r.setName(req.name().trim());
            r.setDescription(req.description());
        } else {
            apply(r, req);
        }
        roles.flush();
        audit.record(userId, userName, null, FEATURE, "Sửa vai trò", null, "Cập nhật vai trò " + r.getName() + ", quyền " + r.getPermissions());
        return find(id);
    }

    @Transactional
    public void delete(UUID id, UUID userId, String userName) {
        Role r = load(id);
        if (r.isSystem()) {
            throw BusinessException.badRequest("ROLE_SYSTEM", "Không xóa được vai trò mặc định của hệ thống");
        }
        int users = roleUsers.countByRole(id);
        if (users > 0) {
            throw BusinessException.badRequest("ROLE_IN_USE", "Vai trò đang được gán cho " + users + " tài khoản, hãy đổi vai trò của họ trước");
        }
        roles.delete(r);
        audit.record(userId, userName, null, FEATURE, "Xóa vai trò", null, "Xóa vai trò " + r.getName());
    }

    private void apply(Role r, RoleRequest req) {
        Set<String> perms = req.permissions() == null ? Set.of() : req.permissions();
        if (!Permissions.ALL.containsAll(perms)) {
            throw BusinessException.badRequest("INVALID_PERMISSION", "Quyền không hợp lệ");
        }
        r.setName(req.name().trim());
        r.setDescription(req.description());
        r.setPermissions(new HashSet<>(perms));
    }

    private Role load(UUID id) {
        return roles.findById(id).orElseThrow(() -> BusinessException.notFound("ROLE_NOT_FOUND", "Không tìm thấy vai trò"));
    }

    private RoleResponse find(UUID id) {
        return list().stream().filter(r -> r.id().equals(id)).findFirst().orElseThrow();
    }
}
