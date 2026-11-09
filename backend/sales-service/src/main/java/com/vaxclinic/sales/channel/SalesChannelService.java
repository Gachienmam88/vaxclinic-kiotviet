package com.vaxclinic.sales.channel;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Thêm / sửa / xóa kênh bán (settings.manage). DIRECT không xóa / tắt được. */
@Service
public class SalesChannelService {

    public record ChannelRequest(@NotBlank(message = "Chưa nhập tên kênh bán") @Size(max = 100) String name,
                                 Boolean active, Integer sortOrder) {
    }

    private final SalesChannels channels;
    private final JdbcTemplate jdbc;
    private final AuditLogger audit;

    public SalesChannelService(SalesChannels channels, JdbcTemplate jdbc, AuditLogger audit) {
        this.channels = channels;
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @Transactional
    public SalesChannels.Channel create(ChannelRequest req, Actor actor) {
        String code = "CH%03d".formatted(jdbc.queryForObject("select nextval('sales_channel_code_seq')", Long.class));
        try {
            jdbc.update("insert into sales_channels(code, name, active, sort_order) values (?,?,?,?)", code, req.name().trim(),
                    req.active() == null || req.active(), req.sortOrder() == null ? 10 : req.sortOrder());
        } catch (DuplicateKeyException e) {
            throw duplicate();
        }
        actor.audit(audit, null, "Kênh bán", "Tạo", code, "Tạo kênh bán " + req.name().trim());
        return find(code);
    }

    @Transactional
    public SalesChannels.Channel update(String code, ChannelRequest req, Actor actor) {
        var current = find(code);
        boolean active = req.active() == null ? current.active() : req.active();
        if (current.builtin() && !active) {
            throw BusinessException.badRequest("CHANNEL_BUILTIN", "Không thể ngừng kênh mặc định " + current.name());
        }
        try {
            jdbc.update("update sales_channels set name = ?, active = ?, sort_order = ? where code = ?", req.name().trim(), active,
                    req.sortOrder() == null ? current.sortOrder() : req.sortOrder(), code);
        } catch (DuplicateKeyException e) {
            throw duplicate();
        }
        actor.audit(audit, null, "Kênh bán", "Sửa", code, "Cập nhật kênh bán " + req.name().trim()
                + (active ? "" : " (ngừng hoạt động)"));
        return find(code);
    }

    /** Kênh đã có hóa đơn / đơn đặt hàng thì không xóa được — chuyển sang ngừng hoạt động. */
    @Transactional
    public void delete(String code, Actor actor) {
        var current = find(code);
        if (current.builtin()) {
            throw BusinessException.badRequest("CHANNEL_BUILTIN", "Không thể xóa kênh mặc định " + current.name());
        }
        Integer used = jdbc.queryForObject("select (select count(*) from invoices where sales_channel = ?)"
                + " + (select count(*) from customer_orders where sales_channel = ?)", Integer.class, code, code);
        if (used != null && used > 0) {
            throw BusinessException.conflict("CHANNEL_IN_USE", "Kênh bán đã có " + used + " giao dịch, hãy chuyển sang ngừng hoạt động");
        }
        jdbc.update("delete from sales_channels where code = ?", code);
        actor.audit(audit, null, "Kênh bán", "Xóa", code, "Xóa kênh bán " + current.name());
    }

    private SalesChannels.Channel find(String code) {
        return channels.list(true).stream().filter(c -> c.code().equals(code)).findFirst()
                .orElseThrow(() -> BusinessException.notFound("CHANNEL_NOT_FOUND", "Không tìm thấy kênh bán"));
    }

    private static BusinessException duplicate() {
        return BusinessException.conflict("CHANNEL_NAME_DUPLICATE", "Tên kênh bán đã tồn tại");
    }
}
