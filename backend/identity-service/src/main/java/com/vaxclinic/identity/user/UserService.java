package com.vaxclinic.identity.user;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.identity.auth.RefreshTokenRepository;
import com.vaxclinic.identity.auth.twofactor.TwoFactorService;
import com.vaxclinic.identity.branch.Branch;
import com.vaxclinic.identity.branch.BranchRepository;
import com.vaxclinic.identity.role.Role;
import com.vaxclinic.identity.role.RoleRepository;
import com.vaxclinic.identity.user.UserDtos.Actor;
import com.vaxclinic.identity.user.UserDtos.CreateUserRequest;
import com.vaxclinic.identity.user.UserDtos.UpdateUserRequest;
import com.vaxclinic.identity.user.UserDtos.UserLookup;
import com.vaxclinic.identity.user.UserDtos.UserResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/** Quản lý người dùng (Thiết lập → Quản lý người dùng). Mọi thao tác ghi đều ghi Lịch sử thao tác tính năng "Người dùng". */
@Service
public class UserService {

    private static final String FEATURE = "Người dùng";

    private final AppUserRepository users;
    private final RoleRepository roles;
    private final BranchRepository branches;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final TwoFactorService twoFactor;
    private final AuditLogger audit;

    public UserService(AppUserRepository users, RoleRepository roles, BranchRepository branches, RefreshTokenRepository refreshTokens,
                       PasswordEncoder passwordEncoder, TwoFactorService twoFactor, AuditLogger audit) {
        this.audit = audit;
        this.users = users;
        this.roles = roles;
        this.branches = branches;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.twoFactor = twoFactor;
    }

    @Transactional(readOnly = true)
    public PageResponse<UserResponse> search(String q, int page, int size) {
        var pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by("username"));
        var twoFactorOn = twoFactor.enabledUserIds();
        return PageResponse.from(users.search(q == null ? "" : q.trim(), pageable),
                u -> UserResponse.of(u, twoFactorOn.contains(u.getId())));
    }

    @Transactional(readOnly = true)
    public java.util.List<UserLookup> lookup() {
        return users.findAll(Sort.by("fullName")).stream().filter(AppUser::isActive)
                .map(u -> new UserLookup(u.getId(), u.getFullName())).toList();
    }

    @Transactional(readOnly = true)
    public UserResponse get(UUID id) {
        return UserResponse.of(find(id), twoFactor.enabled(id));
    }

    @Transactional
    public UserResponse create(CreateUserRequest req, Actor actor) {
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
        UserResponse created = UserResponse.of(users.save(u), false);
        log(actor, "Tạo", "Tạo tài khoản " + created.username() + " (" + created.fullName() + "), vai trò " + created.roleName());
        return created;
    }

    @Transactional
    public UserResponse update(UUID id, UpdateUserRequest req, Actor actor) {
        var u = find(id);
        if (id.equals(actor.id()) && !req.active()) {
            throw BusinessException.badRequest("CANNOT_LOCK_SELF", "Không thể tự khóa tài khoản của mình");
        }
        var role = findRole(req.roleId());
        if (u.isOwner() && (!req.active() || !"ADMIN".equals(role.getCode()))) {
            throw BusinessException.badRequest("OWNER_PROTECTED",
                    "Không thể khóa hoặc đổi vai trò của chủ gian hàng. Chuyển nhượng gian hàng trước (Hồ sơ cửa hàng)");
        }
        u.setFullName(req.fullName().trim());
        u.setPhone(req.phone());
        u.setRole(role);
        u.setBranches(findBranches(req.branchIds()));
        u.setActive(req.active());
        if (!req.active()) {
            refreshTokens.revokeAllForUser(id); // locked user is logged out at next refresh
        }
        log(actor, "Sửa", "Cập nhật tài khoản " + u.getUsername() + ": vai trò " + role.getName()
                + ", " + (u.isActive() ? "đang hoạt động" : "ngừng hoạt động"));
        return UserResponse.of(u, twoFactor.enabled(id));
    }

    @Transactional
    public void resetPassword(UUID id, String newPassword, Actor actor) {
        var u = find(id);
        u.setPasswordHash(passwordEncoder.encode(newPassword));
        refreshTokens.revokeAllForUser(id);
        log(actor, "Đặt lại mật khẩu", "Đặt lại mật khẩu tài khoản " + u.getUsername());
    }

    private void log(Actor actor, String action, String detail) {
        audit.record(actor.id(), actor.name(), null, FEATURE, action, null, detail);
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
            throw BusinessException.badRequest("BRANCH_NOT_FOUND", "Có chi nhánh không tồn tại");
        }
        return new HashSet<>(found);
    }
}
