package com.vaxclinic.integration.inputinvoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.integration.common.SecretCipher;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Hóa đơn đầu vào → "Danh sách kết nối" (tài khoản cổng thuế theo MST) + đồng bộ.
 * Đồng bộ 2 bước: (1) /captcha lấy ảnh captcha, (2) /sync gửi mã người dùng nhập + khoảng ngày.
 */
@RestController
@PreAuthorize("hasAuthority('inventory.manage')")
public class TaxConnectionController {

    public record ConnectionRequest(@NotBlank(message = "Nhập mã số thuế") String taxCode,
                                    @NotBlank(message = "Nhập tên đăng nhập") String username, String password) {
    }

    public record SyncRequest(@NotBlank String captchaKey, @NotBlank(message = "Nhập mã captcha") String captchaValue,
                              @NotNull LocalDate from, @NotNull LocalDate to) {
    }

    public record ConnectionResponse(UUID id, String taxCode, String username, boolean active, Instant lastSyncedAt,
                                     String lastError) {
    }

    private final JdbcTemplate jdbc;
    private final SecretCipher cipher;
    private final GdtPortalClient portal;
    private final InputInvoiceStore store;

    public TaxConnectionController(JdbcTemplate jdbc, SecretCipher cipher, GdtPortalClient portal, InputInvoiceStore store) {
        this.jdbc = jdbc;
        this.cipher = cipher;
        this.portal = portal;
        this.store = store;
    }

    @GetMapping("/api/tax-connections")
    public List<ConnectionResponse> list() {
        return jdbc.query("select * from tax_connections order by created_at", (rs, n) -> new ConnectionResponse(
                rs.getObject("id", UUID.class), rs.getString("tax_code"), rs.getString("username"), rs.getBoolean("active"),
                rs.getTimestamp("last_synced_at") == null ? null : rs.getTimestamp("last_synced_at").toInstant(),
                rs.getString("last_error")));
    }

    @PostMapping("/api/tax-connections")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, UUID> create(@Valid @RequestBody ConnectionRequest req) {
        if (req.password() == null || req.password().isBlank()) {
            throw BusinessException.badRequest("PASSWORD_REQUIRED", "Nhập mật khẩu tài khoản cổng thuế");
        }
        UUID id = UUID.randomUUID();
        try {
            jdbc.update("insert into tax_connections(id, tax_code, username, password_enc) values (?,?,?,?)",
                    id, req.taxCode().trim(), req.username().trim(), cipher.encrypt(req.password()));
        } catch (org.springframework.dao.DuplicateKeyException e) {
            throw BusinessException.conflict("TAX_CONNECTION_EXISTS", "Mã số thuế này đã được kết nối");
        }
        return Map.of("id", id);
    }

    /** Sửa thiết lập; để trống mật khẩu = giữ mật khẩu cũ. */
    @PutMapping("/api/tax-connections/{id}")
    public void update(@PathVariable UUID id, @Valid @RequestBody ConnectionRequest req) {
        int n = req.password() == null || req.password().isBlank()
                ? jdbc.update("update tax_connections set tax_code = ?, username = ? where id = ?", req.taxCode().trim(), req.username().trim(), id)
                : jdbc.update("update tax_connections set tax_code = ?, username = ?, password_enc = ? where id = ?",
                req.taxCode().trim(), req.username().trim(), cipher.encrypt(req.password()), id);
        if (n == 0) {
            throw BusinessException.notFound("TAX_CONNECTION_NOT_FOUND", "Không tìm thấy kết nối");
        }
    }

    @DeleteMapping("/api/tax-connections/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        jdbc.update("delete from tax_connections where id = ?", id);
    }

    @PostMapping("/api/tax-connections/{id}/captcha")
    public GdtPortalClient.Captcha captcha(@PathVariable UUID id) {
        connection(id);
        return portal.captcha();
    }

    @PostMapping("/api/tax-connections/{id}/sync")
    public Map<String, Integer> sync(@PathVariable UUID id, @Valid @RequestBody SyncRequest req) {
        if (req.to().isBefore(req.from()) || ChronoUnit.DAYS.between(req.from(), req.to()) > 31) {
            throw BusinessException.badRequest("RANGE_INVALID", "Mỗi lần đồng bộ tối đa 1 tháng");
        }
        Map<String, Object> c = connection(id);
        try {
            String token = portal.login((String) c.get("username"), cipher.decrypt((String) c.get("password_enc")),
                    req.captchaKey(), req.captchaValue().trim());
            int added = 0;
            var invoices = portal.purchaseInvoices(token, req.from(), req.to());
            for (var s : invoices) {
                boolean sco = s.path("khhdon").asText("").length() > 3 && s.path("khhdon").asText().charAt(3) == 'M';
                var parsed = InputInvoiceStore.fromPortal(s, portal.detail(token, s, sco));
                if (store.upsert(parsed, (String) c.get("tax_code"), "PORTAL")) {
                    added++;
                }
            }
            jdbc.update("update tax_connections set last_synced_at = ?, last_error = null where id = ?", Timestamp.from(Instant.now()), id);
            return Map.of("found", invoices.size(), "added", added);
        } catch (BusinessException e) {
            jdbc.update("update tax_connections set last_error = ? where id = ?", e.getMessage(), id);
            throw e;
        }
    }

    private Map<String, Object> connection(UUID id) {
        var rows = jdbc.queryForList("select * from tax_connections where id = ?", id);
        if (rows.isEmpty()) {
            throw BusinessException.notFound("TAX_CONNECTION_NOT_FOUND", "Không tìm thấy kết nối");
        }
        return rows.get(0);
    }
}
