package com.vaxclinic.identity.role;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.role.RoleDtos.RoleRequest;
import com.vaxclinic.identity.role.RoleDtos.RoleResponse;
import com.vaxclinic.identity.user.UserDtos.Actor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Quản lý vai trò. Vai trò ADMIN luôn đủ mọi quyền, không sửa quyền được.
 * Đổi quyền có hiệu lực khi người dùng đăng nhập lại / làm mới phiên (quyền nằm trong JWT).
 */
@Service
public class RoleService {

    private final RoleRepository roles;
    private final RoleUserRepository roleUsers;
    private final AuditLogger audit;

    public RoleService(RoleRepository roles, RoleUserRepository roleUsers, AuditLogger audit) {
        this.roles = roles;
        this.roleUsers = roleUsers;
        this.audit = audit;
    }

    /** Ghi lịch sử thao tác (tính năng "Thiết lập cửa hàng" / "Người dùng"). */
    private void log(Actor actor, String feature, String action, String detail) {
        audit.record(actor.id(), actor.name(), null, feature, action, null, detail);
    }

    public List<RoleResponse> list() {
        Map<UUID, List<String>> users = roleUsers.activeUsernamesByRole();
        return roles.findAll().stream().sorted(Comparator.comparing(Role::isSystem).reversed().thenComparing(Role::getName))
                .map(r -> new RoleResponse(r.getId(), r.getCode(), r.getName(), r.getDescription(), r.isSystem(),
                        r.getPermissions(), users.getOrDefault(r.getId(), List.of())))
                .toList();
    }

    @Transactional
    public RoleResponse create(RoleRequest req, Actor actor) {
        var r = new Role();
        r.setId(UUID.randomUUID());
        r.setCode("CUSTOM_" + r.getId().toString().substring(0, 8).toUpperCase());
        r.setSystem(false);
        apply(r, req);
        roles.save(r);
        log(actor, "Người dùng", "Tạo vai trò", "Tạo vai trò " + r.getName() + ", quyền " + r.getPermissions());
        return find(r.getId());
    }

    @Transactional
    public RoleResponse update(UUID id, RoleRequest req, Actor actor) {
        Role r = load(id);
        if ("ADMIN".equals(r.getCode())) {
            r.setName(req.name().trim());
            r.setDescription(req.description());
        } else {
            apply(r, req);
        }
        roles.flush();
        log(actor, "Người dùng", "Sửa vai trò", "Cập nhật vai trò " + r.getName() + ", quyền " + r.getPermissions());
        return find(id);
    }

    @Transactional
    public void delete(UUID id, Actor actor) {
        Role r = load(id);
        if (r.isSystem()) {
            throw BusinessException.badRequest("ROLE_SYSTEM", "Không xóa được vai trò mặc định của hệ thống");
        }
        Integer users = roleUsers.countByRole(id);
        if (users != null && users > 0) {
            throw BusinessException.badRequest("ROLE_IN_USE", "Vai trò đang được gán cho " + users + " tài khoản, hãy đổi vai trò của họ trước");
        }
        roles.delete(r);
        log(actor, "Người dùng", "Xóa vai trò", "Xóa vai trò " + r.getName());
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
