package com.vaxclinic.identity.notification.controller;

import com.vaxclinic.identity.notification.service.AnnouncementService;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.identity.notification.dto.AnnouncementDtos.Announcement;
import com.vaxclinic.identity.notification.dto.AnnouncementDtos.AnnouncementRequest;
import com.vaxclinic.identity.user.dto.UserDtos.Actor;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Thông báo nội bộ (tab "Cập nhật" của Hộp thư đến): người có quyền settings.manage viết, mọi người dùng đều thấy.
 * Lưu chung bảng notifications (category UPDATE, type ANNOUNCEMENT); sửa nội dung giữ nguyên trạng thái đã đọc.
 */
@RestController
@PreAuthorize("hasAuthority('settings.manage')")
public class AnnouncementController {

    private final AnnouncementService service;

    public AnnouncementController(AnnouncementService service) {
        this.service = service;
    }

    private static Actor actor(Jwt jwt) {
        return new Actor(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"));
    }

    @GetMapping("/api/announcements")
    public PageResponse<Announcement> list(@RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "20") int size) {
        return service.list(page, size);
    }

    @PostMapping("/api/announcements")
    public Announcement create(@Valid @RequestBody AnnouncementRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.create(req, actor(jwt));
    }

    @PutMapping("/api/announcements/{id}")
    public Announcement update(@PathVariable long id, @Valid @RequestBody AnnouncementRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.update(id, req, actor(jwt));
    }

    @DeleteMapping("/api/announcements/{id}")
    public void delete(@PathVariable long id, @AuthenticationPrincipal Jwt jwt) {
        service.delete(id, actor(jwt));
    }
}
