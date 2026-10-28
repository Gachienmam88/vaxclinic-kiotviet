package com.vaxclinic.identity.user;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.identity.auth.RefreshTokenRepository;
import com.vaxclinic.identity.branch.Branch;
import com.vaxclinic.identity.branch.BranchRepository;
import com.vaxclinic.identity.role.Role;
import com.vaxclinic.identity.role.RoleRepository;
import com.vaxclinic.identity.user.UserDtos.CreateUserRequest;
import com.vaxclinic.identity.user.UserDtos.UpdateUserRequest;
import com.vaxclinic.identity.user.UserDtos.UserResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Service
public class UserService {

    private final AppUserRepository users;
    private final RoleRepository roles;
    private final BranchRepository branches;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;

    public UserService(AppUserRepository users, RoleRepository roles, BranchRepository branches,
                       RefreshTokenRepository refreshTokens, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.roles = roles;
        this.branches = branches;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> search(String q, int page, int size) {
        var pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by("username"));
        return PageResponse.from(users.search(q == null ? "" : q.trim(), pageable), UserResponse::of);
    }

    @Transactional(readOnly = true)
    public UserResponse get(UUID id) {
        return UserResponse.of(find(id));
    }

    @Transactional
    public UserResponse create(CreateUserRequest req) {
        if (users.existsByUsernameIgnoreCase(req.username())) {
            throw BusinessException.conflict("USERNAME_EXISTS", "Tên đăng nhập đã tồn tại");
        }
        var u = new AppUser();
        u.setId(UUID.randomUUID());
        u.setUsername(req.username().toLowerCase());
        u.setPasswordHash(passwordEncoder.encode(req.password()));
        u.setFullName(req.fullName().trim());
        u.setPhone(req.phone());
        u.setRole(findRole(req.roleId()));
        u.setBranches(findBranches(req.branchIds()));
        return UserResponse.of(users.save(u));
    }

    @Transactional
    public UserResponse update(UUID id, UpdateUserRequest req, UUID actorId) {
        var u = find(id);
        if (id.equals(actorId) && !req.active()) {
            throw BusinessException.badRequest("CANNOT_LOCK_SELF", "Không thể tự khóa tài khoản của mình");
        }
        u.setFullName(req.fullName().trim());
        u.setPhone(req.phone());
        u.setRole(findRole(req.roleId()));
        u.setBranches(findBranches(req.branchIds()));
        u.setActive(req.active());
        if (!req.active()) {
            refreshTokens.revokeAllForUser(id); // locked user is logged out at next refresh
        }
        return UserResponse.of(u);
    }

    @Transactional
    public void resetPassword(UUID id, String newPassword) {
        var u = find(id);
        u.setPasswordHash(passwordEncoder.encode(newPassword));
        refreshTokens.revokeAllForUser(id);
    }

    private AppUser find(UUID id) {
        return users.findById(id)
                .orElseThrow(() -> BusinessException.notFound("USER_NOT_FOUND", "Không tìm thấy người dùng"));
    }

    private Role findRole(UUID roleId) {
        return roles.findById(roleId)
                .orElseThrow(() -> BusinessException.badRequest("ROLE_NOT_FOUND", "Vai trò không tồn tại"));
    }

    private Set<Branch> findBranches(Set<UUID> ids) {
        var found = branches.findAllById(ids);
        if (found.size() != ids.size()) {
            throw BusinessException.badRequest("BRANCH_NOT_FOUND", "Có điểm tiêm không tồn tại");
        }
        return new HashSet<>(found);
    }
}
