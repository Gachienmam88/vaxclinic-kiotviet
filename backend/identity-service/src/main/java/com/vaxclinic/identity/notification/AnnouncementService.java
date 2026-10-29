package com.vaxclinic.identity.notification;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.identity.notification.AnnouncementModels.Announcement;
import com.vaxclinic.identity.notification.AnnouncementModels.AnnouncementRequest;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Thông báo nội bộ: kiểm tra link an toàn (chỉ "/..." hoặc http(s)), ghi / sửa / xóa qua {@link AnnouncementRepository},
 * mỗi thao tác ghi Lịch sử thao tác tính năng {@value #FEATURE}.
 */
@Service
public class AnnouncementService {

    private static final String FEATURE = "Thông báo nội bộ";

    private final AnnouncementRepository repo;
    private final AuditLogger audit;

    public AnnouncementService(AnnouncementRepository repo, AuditLogger audit) {
        this.repo = repo;
        this.audit = audit;
    }

    public PageResponse<Announcement> list(int page, int size) {
        int limit = Math.min(Math.max(size, 1), 100);
        long total = repo.count();
        var items = repo.find(limit, (long) Math.max(page, 0) * limit);
        return new PageResponse<>(items, total, page, limit);
    }

    public Announcement create(AnnouncementRequest req, UUID userId, String userName) {
        Long id = repo.insert(req.title().trim(), blankToNull(req.body()), link(req.link()), userId, userName);
        audit.record(userId, userName, null, FEATURE, "Tạo", null, req.title());
        return get(id);
    }

    public Announcement update(long id, AnnouncementRequest req, UUID userId, String userName) {
        int n = repo.update(id, req.title().trim(), blankToNull(req.body()), link(req.link()));
        if (n == 0) {
            throw notFound();
        }
        audit.record(userId, userName, null, FEATURE, "Sửa", null, req.title());
        return get(id);
    }

    public void delete(long id, UUID userId, String userName) {
        Announcement a = get(id);
        repo.delete(id);
        audit.record(userId, userName, null, FEATURE, "Xóa", null, a.title());
    }

    private Announcement get(long id) {
        return repo.findById(id).orElseThrow(AnnouncementService::notFound);
    }

    private static BusinessException notFound() {
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
}
