package com.vaxclinic.identity.notification;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.web.PageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.jdbc.core.JdbcTemplate;
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

import java.time.Instant;
import java.util.UUID;

/**
 * Thông báo nội bộ (tab "Cập nhật" của Hộp thư đến): người có quyền settings.manage viết, mọi người dùng đều thấy.
 * Lưu chung bảng notifications (category UPDATE, type ANNOUNCEMENT); sửa nội dung giữ nguyên trạng thái đã đọc.
 */
@RestController
@PreAuthorize("hasAuthority('settings.manage')")
public class AnnouncementController {

    /** link: đường dẫn trong ứng dụng (/products...) hoặc địa chỉ http(s) bên ngoài; bỏ trống = không có link. */
    public record AnnouncementRequest(@NotBlank(message = "Nhập tiêu đề") @Size(max = 300) String title,
                                      @Size(max = 5000) String body, @Size(max = 500) String link) {
    }

    public record Announcement(long id, String title, String body, String link, String createdByName,
                               Instant createdAt, Instant updatedAt) {
    }

    private static final String FEATURE = "Thông báo nội bộ";

    private final JdbcTemplate jdbc;
    private final AuditLogger audit;

    public AnnouncementController(JdbcTemplate jdbc, AuditLogger audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @GetMapping("/api/announcements")
    public PageResponse<Announcement> list(@RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "20") int size) {
        int limit = Math.min(Math.max(size, 1), 100);
        Long total = jdbc.queryForObject("select count(*) from notifications where type = 'ANNOUNCEMENT'", Long.class);
        var items = jdbc.query("select * from notifications where type = 'ANNOUNCEMENT' order by created_at desc, id desc"
                        + " limit ? offset ?",
                (rs, i) -> new Announcement(rs.getLong("id"), rs.getString("title"), rs.getString("body"), rs.getString("link"),
                        rs.getString("created_by_name"), rs.getTimestamp("created_at").toInstant(),
                        rs.getTimestamp("updated_at").toInstant()),
                limit, (long) Math.max(page, 0) * limit);
        return new PageResponse<>(items, total == null ? 0 : total, page, limit);
    }

    @PostMapping("/api/announcements")
    public Announcement create(@Valid @RequestBody AnnouncementRequest req, @AuthenticationPrincipal Jwt jwt) {
        Long id = jdbc.queryForObject("""
                insert into notifications(category, type, title, body, link, created_by, created_by_name)
                values ('UPDATE', 'ANNOUNCEMENT', ?, ?, ?, ?, ?) returning id""", Long.class,
                req.title().trim(), blankToNull(req.body()), link(req.link()), UUID.fromString(jwt.getSubject()),
                jwt.getClaimAsString("name"));
        log(jwt, "Tạo", req.title());
        return get(id);
    }

    @PutMapping("/api/announcements/{id}")
    public Announcement update(@PathVariable long id, @Valid @RequestBody AnnouncementRequest req, @AuthenticationPrincipal Jwt jwt) {
        int n = jdbc.update("update notifications set title = ?, body = ?, link = ?, updated_at = now()"
                        + " where id = ? and type = 'ANNOUNCEMENT'",
                req.title().trim(), blankToNull(req.body()), link(req.link()), id);
        if (n == 0) {
            throw notFound();
        }
        log(jwt, "Sửa", req.title());
        return get(id);
    }

    @DeleteMapping("/api/announcements/{id}")
    public void delete(@PathVariable long id, @AuthenticationPrincipal Jwt jwt) {
        Announcement a = get(id);
        jdbc.update("delete from notifications where id = ? and type = 'ANNOUNCEMENT'", id);
        log(jwt, "Xóa", a.title());
    }

    private Announcement get(Long id) {
        return jdbc.query("select * from notifications where id = ? and type = 'ANNOUNCEMENT'",
                (rs, i) -> new Announcement(rs.getLong("id"), rs.getString("title"), rs.getString("body"), rs.getString("link"),
                        rs.getString("created_by_name"), rs.getTimestamp("created_at").toInstant(),
                        rs.getTimestamp("updated_at").toInstant()), id).stream().findFirst().orElseThrow(this::notFound);
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

    private void log(Jwt jwt, String action, String title) {
        audit.record(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"), null, FEATURE, action, null, title);
    }
}
