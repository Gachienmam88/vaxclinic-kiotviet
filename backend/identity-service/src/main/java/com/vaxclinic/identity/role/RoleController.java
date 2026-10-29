package com.vaxclinic.identity.role;

import com.vaxclinic.identity.role.RoleModels.RoleRequest;
import com.vaxclinic.identity.role.RoleModels.RoleResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Quản lý vai trò (Thiết lập → Quản lý người dùng → Quản lý vai trò). Nghiệp vụ ở {@link RoleService}.
 * Đổi quyền có hiệu lực khi người dùng đăng nhập lại / làm mới phiên (quyền nằm trong JWT).
 */
@RestController
@RequestMapping("/api/roles")
public class RoleController {

    private final RoleService service;

    public RoleController(RoleService service) {
        this.service = service;
    }

    @GetMapping
    public List<RoleResponse> list() {
        return service.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('user.manage')")
    public RoleResponse create(@Valid @RequestBody RoleRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.create(req, userId(jwt), jwt.getClaimAsString("name"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('user.manage')")
    public RoleResponse update(@PathVariable UUID id, @Valid @RequestBody RoleRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.update(id, req, userId(jwt), jwt.getClaimAsString("name"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('user.manage')")
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.delete(id, userId(jwt), jwt.getClaimAsString("name"));
    }

    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }
}
