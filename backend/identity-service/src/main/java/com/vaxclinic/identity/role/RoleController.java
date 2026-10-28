package com.vaxclinic.identity.role;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/roles")
public class RoleController {

    private final RoleRepository roles;

    public RoleController(RoleRepository roles) {
        this.roles = roles;
    }

    public record RoleResponse(UUID id, String code, String name, boolean system, Set<String> permissions) {
    }

    @GetMapping
    public List<RoleResponse> list() {
        return roles.findAll().stream()
                .map(r -> new RoleResponse(r.getId(), r.getCode(), r.getName(), r.isSystem(), r.getPermissions()))
                .toList();
    }
}
