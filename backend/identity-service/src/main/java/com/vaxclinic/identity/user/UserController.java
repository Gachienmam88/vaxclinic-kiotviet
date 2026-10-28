package com.vaxclinic.identity.user;

import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.identity.user.UserDtos.CreateUserRequest;
import com.vaxclinic.identity.user.UserDtos.ResetPasswordRequest;
import com.vaxclinic.identity.user.UserDtos.UpdateUserRequest;
import com.vaxclinic.identity.user.UserDtos.UserResponse;
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

@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasAuthority('user.manage')")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
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

    public record UserLookup(UUID id, String fullName) {
    }

    @GetMapping("/{id}")
    public UserResponse get(@PathVariable UUID id) {
        return userService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody CreateUserRequest req) {
        return userService.create(req);
    }

    @PutMapping("/{id}")
    public UserResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest req,
                               @AuthenticationPrincipal Jwt jwt) {
        return userService.update(id, req, UUID.fromString(jwt.getSubject()));
    }

    @PostMapping("/{id}/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@PathVariable UUID id, @Valid @RequestBody ResetPasswordRequest req) {
        userService.resetPassword(id, req.password());
    }
}
