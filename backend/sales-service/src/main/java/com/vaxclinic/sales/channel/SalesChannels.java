package com.vaxclinic.sales.channel;

import com.vaxclinic.common.error.BusinessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/** Danh sách kênh bán (Thiết lập → Kênh bán) + kiểm tra mã kênh khi lưu hóa đơn / đơn đặt hàng. */
@Component
public class SalesChannels {

    public static final String DIRECT = "DIRECT";

    public record Channel(String code, String name, boolean active, boolean builtin, int sortOrder) {
    }

    private final JdbcTemplate jdbc;

    public SalesChannels(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Channel> list(boolean all) {
        return jdbc.query("select * from sales_channels" + (all ? "" : " where active") + " order by sort_order, name",
                (rs, n) -> new Channel(rs.getString("code"), rs.getString("name"), rs.getBoolean("active"),
                        rs.getBoolean("builtin"), rs.getInt("sort_order")));
    }

    /**
     * Mã kênh hợp lệ để lưu: trống → DIRECT; phải là kênh đang hoạt động, trừ khi giữ nguyên kênh cũ của chứng từ
     * (sửa hóa đơn bán qua kênh đã ngừng hoạt động vẫn lưu được).
     */
    public String resolve(String code, String current) {
        String c = code == null || code.isBlank() ? DIRECT : code.trim();
        if (c.equals(current)) {
            return c;
        }
        List<Map<String, Object>> rows = jdbc.queryForList("select active from sales_channels where code = ?", c);
        if (rows.isEmpty() || !Boolean.TRUE.equals(rows.get(0).get("active"))) {
            throw BusinessException.badRequest("CHANNEL_NOT_FOUND", "Kênh bán không tồn tại hoặc đã ngừng hoạt động");
        }
        return c;
    }
}
