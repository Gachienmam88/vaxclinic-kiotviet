package com.vaxclinic.identity.settings;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Mẫu in đã sửa (Thiết lập → Mẫu in). Chỉ lưu mẫu người dùng đã sửa; loại chưa sửa → trình duyệt dùng mẫu mặc định.
 * Lưu trong app_settings với khóa "print:{TYPE}". Trình duyệt lọc bỏ script trước khi in.
 */
@RestController
@RequestMapping("/api/print-templates")
public class PrintTemplateController {

    static final Set<String> TYPES = Set.of("INVOICE", "SALES_RETURN", "CASH_RECEIPT", "CASH_PAYMENT",
            "PURCHASE_RECEIPT", "PURCHASE_RETURN");

    public record TemplateRequest(@NotBlank @Size(max = 200_000) String html) {
    }

    private final SettingsStore store;
    private final JdbcTemplate jdbc;
    private final AuditLogger audit;

    public PrintTemplateController(SettingsStore store, JdbcTemplate jdbc, AuditLogger audit) {
        this.store = store;
        this.jdbc = jdbc;
        this.audit = audit;
    }

    /** Ghi lịch sử thao tác (tính năng "Thiết lập cửa hàng" / "Người dùng"). */
    private void log(Jwt jwt, String feature, String action, String detail) {
        audit.record(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"), null, feature, action, null, detail);
    }

    @GetMapping
    public Map<String, String> list() {
        Map<String, String> out = new HashMap<>();
        for (String type : TYPES) {
            TemplateRequest t = store.read("print:" + type, TemplateRequest.class);
            if (t != null) {
                out.put(type, t.html());
            }
        }
        return out;
    }

    @PutMapping("/{type}")
    @PreAuthorize("hasAuthority('settings.manage')")
    public Map<String, String> save(@PathVariable String type, @Valid @RequestBody TemplateRequest req,
                                    @AuthenticationPrincipal Jwt jwt) {
        store.write("print:" + checkType(type), req, UUID.fromString(jwt.getSubject()));
        log(jwt, "Mẫu in", "Sửa", "Sửa mẫu in " + type);
        return list();
    }

    /** Đặt lại về mẫu mặc định. */
    @DeleteMapping("/{type}")
    @PreAuthorize("hasAuthority('settings.manage')")
    public Map<String, String> reset(@PathVariable String type, @AuthenticationPrincipal Jwt jwt) {
        jdbc.update("delete from app_settings where key = ?", "print:" + checkType(type));
        log(jwt, "Mẫu in", "Đặt lại", "Đặt lại mẫu in mặc định " + type);
        return list();
    }

    private static String checkType(String type) {
        if (!TYPES.contains(type)) {
            throw BusinessException.badRequest("INVALID_TEMPLATE_TYPE", "Loại mẫu in không hợp lệ");
        }
        return type;
    }
}
