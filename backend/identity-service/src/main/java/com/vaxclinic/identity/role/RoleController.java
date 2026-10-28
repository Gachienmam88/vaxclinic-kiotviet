package com.vaxclinic.identity.role;

import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Quản lý vai trò (Thiết lập → Quản lý người dùng → Quản lý vai trò). Vai trò ADMIN luôn đủ mọi quyền, không sửa quyền được.
 * Đổi quyền có hiệu lực khi người dùng đăng nhập lại / làm mới phiên (quyền nằm trong JWT).
 */
@RestController
@RequestMapping("/api/roles")
public class RoleController {

    private final RoleRepository roles;
    private final JdbcTemplate jdbc;
    private final AuditLogger audit;

    public RoleController(RoleRepository roles, JdbcTemplate jdbc, AuditLogger audit) {
        this.roles = roles;
        this.jdbc = jdbc;
        this.audit = audit;
    }

    /** Ghi lịch sử thao tác (tính năng "Thiết lập cửa hàng" / "Người dùng"). */
    private void log(Jwt jwt, String feature, String action, String detail) {
        audit.record(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"), null, feature, action, null, detail);
    }

    public record RoleResponse(UUID id, String code, String name, String description, boolean system,
                               Set<String> permissions, List<String> usernames) {
    }

    public record RoleRequest(@NotBlank @Size(max = 100) String name, @Size(max = 500) String description,
                              Set<String> permissions) {
    }

    @GetMapping
    public List<RoleResponse> list() {
        Map<UUID, List<String>> users = jdbc.query("select role_id, username from users where active order by username",
                rs -> {
                    var m = new java.util.HashMap<UUID, List<String>>();
                    while (rs.next()) {
                        m.computeIfAbsent(rs.getObject(1, UUID.class), k -> new java.util.ArrayList<>()).add(rs.getString(2));
                    }
                    return m;
                });
        return roles.findAll().stream().sorted(Comparator.comparing(Role::isSystem).reversed().thenComparing(Role::getName))
                .map(r -> new RoleResponse(r.getId(), r.getCode(), r.getName(), r.getDescription(), r.isSystem(),
                        r.getPermissions(), users.getOrDefault(r.getId(), List.of())))
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('user.manage')")
    @Transactional
    public RoleResponse create(@Valid @RequestBody RoleRequest req, @AuthenticationPrincipal Jwt jwt) {
        var r = new Role();
        r.setId(UUID.randomUUID());
        r.setCode("CUSTOM_" + r.getId().toString().substring(0, 8).toUpperCase());
        r.setSystem(false);
        apply(r, req);
        roles.save(r);
        log(jwt, "Người dùng", "Tạo vai trò", "Tạo vai trò " + r.getName() + ", quyền " + r.getPermissions());
        return find(r.getId());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('user.manage')")
    @Transactional
    public RoleResponse update(@PathVariable UUID id, @Valid @RequestBody RoleRequest req, @AuthenticationPrincipal Jwt jwt) {
        Role r = load(id);
        if ("ADMIN".equals(r.getCode())) {
            r.setName(req.name().trim());
            r.setDescription(req.description());
        } else {
            apply(r, req);
        }
        roles.flush();
        log(jwt, "Người dùng", "Sửa vai trò", "Cập nhật vai trò " + r.getName() + ", quyền " + r.getPermissions());
        return find(id);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('user.manage')")
    @Transactional
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        Role r = load(id);
        if (r.isSystem()) {
            throw BusinessException.badRequest("ROLE_SYSTEM", "Không xóa được vai trò mặc định của hệ thống");
        }
        Integer users = jdbc.queryForObject("select count(*) from users where role_id = ?", Integer.class, id);
        if (users != null && users > 0) {
            throw BusinessException.badRequest("ROLE_IN_USE", "Vai trò đang được gán cho " + users + " tài khoản, hãy đổi vai trò của họ trước");
        }
        roles.delete(r);
        log(jwt, "Người dùng", "Xóa vai trò", "Xóa vai trò " + r.getName());
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
