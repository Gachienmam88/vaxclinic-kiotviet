package com.vaxclinic.identity.user.controller;

import com.vaxclinic.identity.user.service.UserService;
import com.vaxclinic.identity.user.service.UserTwoFactorResetService;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.identity.user.dto.UserDtos.Actor;
import com.vaxclinic.identity.user.dto.UserDtos.CreateUserRequest;
import com.vaxclinic.identity.user.dto.UserDtos.ResetPasswordRequest;
import com.vaxclinic.identity.user.dto.UserDtos.ResetTwoFactorRequest;
import com.vaxclinic.identity.user.dto.UserDtos.UpdateUserRequest;
import com.vaxclinic.identity.user.dto.UserDtos.UserLookup;
import com.vaxclinic.identity.user.dto.UserDtos.UserResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Thiết lập → Quản lý người dùng. Controller chỉ nhận request + kiểm tra quyền rồi chuyển cho service:
 * UserController → UserService / UserTwoFactorResetService → AppUserRepository (và các repository liên quan).
 */
@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasAuthority('user.manage')")
public class UserController {

    private final UserService userService;
    private final UserTwoFactorResetService twoFactorReset;

    public UserController(UserService userService, UserTwoFactorResetService twoFactorReset) {
        this.userService = userService;
        this.twoFactorReset = twoFactorReset;
    }

    @GetMapping
    public PageResponse<UserResponse> search(@RequestParam(defaultValue = "") String q,
                                             @RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "20") int size) {
        return userService.search(q, page, size);
    }

    /** Danh sách rút gọn (id, họ tên) user đang hoạt động — cho ô chọn "Người nhập", "Người tạo". Mọi user đăng nhập đều xem được. */
    @GetMapping("/lookup")
    @PreAuthorize("isAuthenticated()")
    public java.util.List<UserLookup> lookup() {
        return userService.lookup();
    }

    @GetMapping("/{id}")
    public UserResponse get(@PathVariable UUID id) {
        return userService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody CreateUserRequest req, @AuthenticationPrincipal Jwt jwt) {
        return userService.create(req, actor(jwt));
    }

    @PutMapping("/{id}")
    public UserResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest req,
                               @AuthenticationPrincipal Jwt jwt) {
        return userService.update(id, req, actor(jwt));
    }

    @PostMapping("/{id}/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@PathVariable UUID id, @Valid @RequestBody ResetPasswordRequest req, @AuthenticationPrincipal Jwt jwt) {
        userService.resetPassword(id, req.password(), actor(jwt));
    }

    /** Đặt lại xác thực 2 lớp cho user khác (mất điện thoại + mã khôi phục). Quy tắc ở {@link UserTwoFactorResetService}. */
    @PostMapping("/{id}/2fa/reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetTwoFactor(@PathVariable UUID id, @Valid @RequestBody ResetTwoFactorRequest req, @AuthenticationPrincipal Jwt jwt) {
        twoFactorReset.reset(id, actor(jwt), req.password(), req.code());
    }

    private static Actor actor(Jwt jwt) {
        return new Actor(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"));
    }
}
