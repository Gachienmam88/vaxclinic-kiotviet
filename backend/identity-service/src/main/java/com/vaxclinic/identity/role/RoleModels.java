package com.vaxclinic.identity.role;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/** DTO màn hình Quản lý vai trò. */
public final class RoleModels {

    private RoleModels() {
    }

    public record RoleResponse(UUID id, String code, String name, String description, boolean system,
                               Set<String> permissions, List<String> usernames) {
    }

    public record RoleRequest(@NotBlank @Size(max = 100) String name, @Size(max = 500) String description,
                              Set<String> permissions) {
    }
}
