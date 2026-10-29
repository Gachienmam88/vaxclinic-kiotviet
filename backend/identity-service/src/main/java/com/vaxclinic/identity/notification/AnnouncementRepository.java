package com.vaxclinic.identity.notification;

import com.vaxclinic.identity.notification.AnnouncementModels.Announcement;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Thông báo nội bộ trong bảng notifications (category UPDATE, type ANNOUNCEMENT). Chỉ truy cập DB. */
@Repository
public class AnnouncementRepository {

    private static final RowMapper<Announcement> MAPPER = (rs, i) -> new Announcement(rs.getLong("id"), rs.getString("title"),
            rs.getString("body"), rs.getString("link"), rs.getString("created_by_name"), rs.getTimestamp("created_at").toInstant(),
            rs.getTimestamp("updated_at").toInstant());

    private final JdbcTemplate jdbc;

    public AnnouncementRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public long count() {
        Long total = jdbc.queryForObject("select count(*) from notifications where type = 'ANNOUNCEMENT'", Long.class);
        return total == null ? 0 : total;
    }

    /** Mới nhất trước. */
    public List<Announcement> find(int limit, long offset) {
        return jdbc.query("select * from notifications where type = 'ANNOUNCEMENT' order by created_at desc, id desc"
                + " limit ? offset ?", MAPPER, limit, offset);
    }

    public Optional<Announcement> findById(long id) {
        return jdbc.query("select * from notifications where id = ? and type = 'ANNOUNCEMENT'", MAPPER, id).stream().findFirst();
    }

    public Long insert(String title, String body, String link, UUID createdBy, String createdByName) {
        return jdbc.queryForObject("""
                insert into notifications(category, type, title, body, link, created_by, created_by_name)
                values ('UPDATE', 'ANNOUNCEMENT', ?, ?, ?, ?, ?) returning id""", Long.class,
                title, body, link, createdBy, createdByName);
    }

    /** Số dòng đã sửa (0 = không có). Giữ nguyên trạng thái đã đọc. */
    public int update(long id, String title, String body, String link) {
        return jdbc.update("update notifications set title = ?, body = ?, link = ?, updated_at = now()"
                + " where id = ? and type = 'ANNOUNCEMENT'", title, body, link, id);
    }

    public void delete(long id) {
        jdbc.update("delete from notifications where id = ? and type = 'ANNOUNCEMENT'", id);
    }
}
