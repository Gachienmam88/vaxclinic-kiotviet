package com.vaxclinic.product.inventory;

import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.product.inventory.InventoryDocDtos.IssueListItem;
import com.vaxclinic.product.inventory.InventoryDocDtos.TakeListItem;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Danh sách phiếu kiểm kho / xuất hủy / xuất dùng nội bộ với bộ lọc bên trái (trạng thái, thời gian, người tạo). */
@Repository
public class InventoryDocListRepository {

    public record Filter(String q, List<String> statuses, Instant from, Instant to, UUID createdBy, UUID branchId,
                         int page, int size) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public InventoryDocListRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public PageResponse<TakeListItem> takes(Filter f) {
        var p = new MapSqlParameterSource();
        String from = " from stock_takes d" + where(f, p, "d.taken_at");
        long total = jdbc.queryForObject("select count(*)" + from, p, Long.class);
        page(f, p);
        var items = jdbc.query("select d.*" + from + " order by d.taken_at desc limit :limit offset :offset", p,
                (rs, i) -> new TakeListItem(rs.getObject("id", UUID.class), rs.getString("code"),
                        rs.getObject("branch_id", UUID.class), rs.getString("status"), instant(rs, "taken_at"),
                        instant(rs, "balanced_at"), rs.getString("created_by_name"), rs.getBigDecimal("actual_qty"),
                        rs.getBigDecimal("actual_value"), rs.getBigDecimal("diff_value"),
                        rs.getBigDecimal("increase_qty"), rs.getBigDecimal("decrease_qty"), rs.getString("note")));
        return new PageResponse<>(items, total, f.page(), f.size());
    }

    public PageResponse<IssueListItem> issues(StockIssue.Type type, Filter f) {
        var p = new MapSqlParameterSource("type", type.name());
        String from = " from stock_issues d" + where(f, p, "d.issued_at") + " and d.type = :type";
        long total = jdbc.queryForObject("select count(*)" + from, p, Long.class);
        page(f, p);
        var items = jdbc.query("select d.*" + from + " order by d.issued_at desc limit :limit offset :offset", p,
                (rs, i) -> new IssueListItem(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("type"),
                        rs.getObject("branch_id", UUID.class), rs.getString("status"), instant(rs, "issued_at"),
                        rs.getString("created_by_name"), rs.getString("reason"), rs.getString("note"),
                        rs.getBigDecimal("total_qty"), rs.getBigDecimal("total_value")));
        return new PageResponse<>(items, total, f.page(), f.size());
    }

    /** Điều kiện chung; mọi đoạn bắt đầu bằng khoảng trắng để nối chuỗi an toàn. */
    private static String where(Filter f, MapSqlParameterSource p, String timeCol) {
        var w = new StringBuilder(" where 1=1");
        if (f.q() != null && !f.q().isBlank()) {
            w.append(" and d.code ilike :q");
            p.addValue("q", "%" + f.q().trim() + "%");
        }
        if (f.statuses() != null && !f.statuses().isEmpty()) {
            w.append(" and d.status in (:statuses)");
            p.addValue("statuses", f.statuses());
        }
        if (f.from() != null) {
            w.append(" and ").append(timeCol).append(" >= :from");
            p.addValue("from", Timestamp.from(f.from()));
        }
        if (f.to() != null) {
            w.append(" and ").append(timeCol).append(" < :to");
            p.addValue("to", Timestamp.from(f.to()));
        }
        if (f.createdBy() != null) {
            w.append(" and d.created_by = :createdBy");
            p.addValue("createdBy", f.createdBy());
        }
        if (f.branchId() != null) {
            w.append(" and d.branch_id = :branchId");
            p.addValue("branchId", f.branchId());
        }
        return w.toString();
    }

    private static void page(Filter f, MapSqlParameterSource p) {
        p.addValue("limit", f.size()).addValue("offset", (long) f.page() * f.size());
    }

    private static Instant instant(ResultSet rs, String col) throws SQLException {
        Timestamp t = rs.getTimestamp(col);
        return t == null ? null : t.toInstant();
    }
}
