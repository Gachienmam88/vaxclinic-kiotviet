package com.vaxclinic.sales.channel;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Kênh bán: xem (bán hàng / báo cáo / thiết lập), thêm / sửa / xóa (settings.manage). DIRECT không xóa / tắt được. */
@RestController
@RequestMapping("/api/sales-channels")
@PreAuthorize("hasAuthority('sales.perform') or hasAuthority('report.view') or hasAuthority('settings.manage')")
public class SalesChannelController {

    public record ChannelRequest(@NotBlank(message = "Chưa nhập tên kênh bán") @Size(max = 100) String name,
                                 Boolean active, Integer sortOrder) {
    }

    private final SalesChannels channels;
    private final JdbcTemplate jdbc;
    private final AuditLogger audit;

    public SalesChannelController(SalesChannels channels, JdbcTemplate jdbc, AuditLogger audit) {
        this.channels = channels;
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @GetMapping
    public List<SalesChannels.Channel> list(@RequestParam(defaultValue = "false") boolean all) {
        return channels.list(all);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('settings.manage')")
    @Transactional
    public SalesChannels.Channel create(@Valid @RequestBody ChannelRequest req, @AuthenticationPrincipal Jwt jwt) {
        String code = "CH%03d".formatted(jdbc.queryForObject("select nextval('sales_channel_code_seq')", Long.class));
        try {
            jdbc.update("insert into sales_channels(code, name, active, sort_order) values (?,?,?,?)", code, req.name().trim(),
                    req.active() == null || req.active(), req.sortOrder() == null ? 10 : req.sortOrder());
        } catch (DuplicateKeyException e) {
            throw duplicate();
        }
        Actor.of(jwt).audit(audit, null, "Kênh bán", "Tạo", code, "Tạo kênh bán " + req.name().trim());
        return find(code);
    }

    @PutMapping("/{code}")
    @PreAuthorize("hasAuthority('settings.manage')")
    @Transactional
    public SalesChannels.Channel update(@PathVariable String code, @Valid @RequestBody ChannelRequest req,
                                        @AuthenticationPrincipal Jwt jwt) {
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
        Actor.of(jwt).audit(audit, null, "Kênh bán", "Sửa", code, "Cập nhật kênh bán " + req.name().trim()
                + (active ? "" : " (ngừng hoạt động)"));
        return find(code);
    }

    /** Kênh đã có hóa đơn / đơn đặt hàng thì không xóa được — chuyển sang ngừng hoạt động. */
    @DeleteMapping("/{code}")
    @PreAuthorize("hasAuthority('settings.manage')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable String code, @AuthenticationPrincipal Jwt jwt) {
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
        Actor.of(jwt).audit(audit, null, "Kênh bán", "Xóa", code, "Xóa kênh bán " + current.name());
    }

    private SalesChannels.Channel find(String code) {
        return channels.list(true).stream().filter(c -> c.code().equals(code)).findFirst()
                .orElseThrow(() -> BusinessException.notFound("CHANNEL_NOT_FOUND", "Không tìm thấy kênh bán"));
    }

    private static BusinessException duplicate() {
        return BusinessException.conflict("CHANNEL_NAME_DUPLICATE", "Tên kênh bán đã tồn tại");
    }
}
