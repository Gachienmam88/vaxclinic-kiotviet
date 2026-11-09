package com.vaxclinic.identity.notification.service;

import com.vaxclinic.identity.notification.repository.AnnouncementRepository;
import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.identity.notification.dto.AnnouncementDtos.Announcement;
import com.vaxclinic.identity.notification.dto.AnnouncementDtos.AnnouncementRequest;
import com.vaxclinic.identity.user.dto.UserDtos.Actor;
import org.springframework.stereotype.Service;

/**
 * Thông báo nội bộ (tab "Cập nhật" của Hộp thư đến): người có quyền settings.manage viết, mọi người dùng đều thấy.
 * Lưu chung bảng notifications (category UPDATE, type ANNOUNCEMENT); sửa nội dung giữ nguyên trạng thái đã đọc.
 */
@Service
public class AnnouncementService {

    private static final String FEATURE = "Thông báo nội bộ";

    private final AnnouncementRepository announcements;
    private final AuditLogger audit;

    public AnnouncementService(AnnouncementRepository announcements, AuditLogger audit) {
        this.announcements = announcements;
        this.audit = audit;
    }

    public PageResponse<Announcement> list(int page, int size) {
        int limit = Math.min(Math.max(size, 1), 100);
        Long total = announcements.count();
        var items = announcements.page(limit, (long) Math.max(page, 0) * limit);
        return new PageResponse<>(items, total == null ? 0 : total, page, limit);
    }

    public Announcement create(AnnouncementRequest req, Actor actor) {
        Long id = announcements.insert(req.title().trim(), blankToNull(req.body()), link(req.link()), actor.id(), actor.name());
        log(actor, "Tạo", req.title());
        return get(id);
    }

    public Announcement update(long id, AnnouncementRequest req, Actor actor) {
        int n = announcements.update(id, req.title().trim(), blankToNull(req.body()), link(req.link()));
        if (n == 0) {
            throw notFound();
        }
        log(actor, "Sửa", req.title());
        return get(id);
    }

    public void delete(long id, Actor actor) {
        Announcement a = get(id);
        announcements.delete(id);
        log(actor, "Xóa", a.title());
    }

    private Announcement get(Long id) {
        return announcements.find(id).orElseThrow(this::notFound);
    }

    private BusinessException notFound() {
        return BusinessException.notFound("ANNOUNCEMENT_NOT_FOUND", "Không tìm thấy thông báo");
    }

    /** Chỉ nhận đường dẫn nội bộ ("/...") hoặc http(s) — chặn javascript:, data:... */
    private static String link(String link) {
        String v = blankToNull(link);
        if (v != null && !(v.startsWith("/") && !v.startsWith("//")) && !v.matches("(?i)^https?://.+")) {
            throw BusinessException.badRequest("INVALID_LINK", "Đường dẫn phải bắt đầu bằng / hoặc http(s)://");
        }
        return v;
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    private void log(Actor actor, String action, String title) {
        audit.record(actor.id(), actor.name(), null, FEATURE, action, null, title);
    }
}
