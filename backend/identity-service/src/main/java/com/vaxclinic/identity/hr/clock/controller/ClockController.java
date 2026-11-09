package com.vaxclinic.identity.hr.clock.controller;

import com.vaxclinic.identity.hr.clock.service.ClockService;
import com.vaxclinic.identity.hr.dto.HrActor;
import com.vaxclinic.identity.hr.clock.dto.ClockDtos.ClockRequest;
import com.vaxclinic.identity.hr.clock.dto.ClockDtos.ClockResult;
import com.vaxclinic.identity.hr.clock.dto.ClockDtos.Me;
import com.vaxclinic.identity.hr.clock.dto.ClockDtos.QrToken;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Chấm công trên điện thoại (/cham-cong). Nhân viên = tài khoản đăng nhập đã liên kết hồ sơ nhân viên.
 * Bắt buộc QR (mặc định): token lấy từ mã QR đang hiển thị tại quầy chi nhánh (đổi mỗi 60 giây), kiểm tra HMAC phía server.
 */
@RestController
public class ClockController {

    private final ClockService service;

    public ClockController(ClockService service) {
        this.service = service;
    }

    /** Mã QR hiển thị tại quầy (Thiết lập → Chấm công điện thoại → Hiện mã QR chi nhánh); màn hình gọi lại mỗi 60 giây. */
    @GetMapping("/api/hr/clock/qr")
    @PreAuthorize("hasAuthority('hr.manage')")
    public QrToken qr(@RequestParam UUID branchId) {
        return service.qr(branchId);
    }

    @GetMapping("/api/hr/clock/me")
    @PreAuthorize("isAuthenticated()")
    public Me me(@AuthenticationPrincipal Jwt jwt) {
        return service.me(UUID.fromString(jwt.getSubject()));
    }

    @PostMapping("/api/hr/clock")
    @PreAuthorize("isAuthenticated()")
    public ClockResult punch(@Valid @RequestBody ClockRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.punch(req, UUID.fromString(jwt.getSubject()), HrActor.of(jwt));
    }
}
