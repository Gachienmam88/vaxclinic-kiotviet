package com.vaxclinic.identity.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Request/response DTOs for user management. */
public final class UserDtos {

    private UserDtos() {
    }

    public record CreateUserRequest(
            @NotBlank @Pattern(regexp = "^[a-zA-Z0-9._-]{3,50}$", message = "3-50 ký tự: chữ, số, . _ -") String username,
            @NotBlank @Size(min = 8, max = 100, message = "Mật khẩu tối thiểu 8 ký tự") String password,
            @NotBlank @Size(max = 150) String fullName,
            @Size(max = 20) String phone,
            @NotNull UUID roleId,
            @NotEmpty(message = "Chọn ít nhất 1 điểm tiêm") Set<UUID> branchIds) {
    }

    public record UpdateUserRequest(
            @NotBlank @Size(max = 150) String fullName,
            @Size(max = 20) String phone,
            @NotNull UUID roleId,
            @NotEmpty(message = "Chọn ít nhất 1 điểm tiêm") Set<UUID> branchIds,
            boolean active) {
    }

    public record ResetPasswordRequest(
            @NotBlank @Size(min = 8, max = 100, message = "Mật khẩu tối thiểu 8 ký tự") String password) {
    }

    public record BranchRef(UUID id, String code, String name) {
    }

    public record UserResponse(UUID id, String username, String fullName, String phone, boolean active,
                               UUID roleId, String roleCode, String roleName, List<BranchRef> branches) {

        public static UserResponse of(AppUser u) {
            var branches = u.getBranches().stream()
                    .map(b -> new BranchRef(b.getId(), b.getCode(), b.getName()))
                    .sorted((a, b) -> a.code().compareTo(b.code()))
                    .toList();
            return new UserResponse(u.getId(), u.getUsername(), u.getFullName(), u.getPhone(), u.isActive(),
                    u.getRole().getId(), u.getRole().getCode(), u.getRole().getName(), branches);
        }
    }
}
