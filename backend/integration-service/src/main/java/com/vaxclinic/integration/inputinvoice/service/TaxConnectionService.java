package com.vaxclinic.integration.inputinvoice.service;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.integration.common.SecretCipher;
import com.vaxclinic.integration.inputinvoice.client.GdtPortalClient;
import com.vaxclinic.integration.inputinvoice.dto.TaxConnectionDtos.ConnectionRequest;
import com.vaxclinic.integration.inputinvoice.dto.TaxConnectionDtos.ConnectionResponse;
import com.vaxclinic.integration.inputinvoice.dto.TaxConnectionDtos.SyncRequest;
import com.vaxclinic.integration.inputinvoice.dto.TaxConnectionDtos.SyncResult;
import com.vaxclinic.integration.inputinvoice.repository.TaxConnectionRepository;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Hóa đơn đầu vào → "Danh sách kết nối" (tài khoản cổng thuế theo MST) + đồng bộ.
 * Đồng bộ 2 bước: (1) /captcha lấy ảnh captcha, (2) /sync gửi mã người dùng nhập + khoảng ngày.
 */
@Service
public class TaxConnectionService {

    private final TaxConnectionRepository repo;
    private final SecretCipher cipher;
    private final GdtPortalClient portal;
    private final InputInvoiceStore store;

    public TaxConnectionService(TaxConnectionRepository repo, SecretCipher cipher, GdtPortalClient portal, InputInvoiceStore store) {
        this.repo = repo;
        this.cipher = cipher;
        this.portal = portal;
        this.store = store;
    }

    public List<ConnectionResponse> list() {
        return repo.list();
    }

    public UUID create(ConnectionRequest req) {
        if (req.password() == null || req.password().isBlank()) {
            throw BusinessException.badRequest("PASSWORD_REQUIRED", "Nhập mật khẩu tài khoản cổng thuế");
        }
        UUID id = UUID.randomUUID();
        try {
            repo.insert(id, req.taxCode().trim(), req.username().trim(), cipher.encrypt(req.password()));
        } catch (org.springframework.dao.DuplicateKeyException e) {
            throw BusinessException.conflict("TAX_CONNECTION_EXISTS", "Mã số thuế này đã được kết nối");
        }
        return id;
    }

    /** Sửa thiết lập; để trống mật khẩu = giữ mật khẩu cũ. */
    public void update(UUID id, ConnectionRequest req) {
        int n = req.password() == null || req.password().isBlank()
                ? repo.update(id, req.taxCode().trim(), req.username().trim())
                : repo.update(id, req.taxCode().trim(), req.username().trim(), cipher.encrypt(req.password()));
        if (n == 0) {
            throw BusinessException.notFound("TAX_CONNECTION_NOT_FOUND", "Không tìm thấy kết nối");
        }
    }

    public void delete(UUID id) {
        repo.delete(id);
    }

    public GdtPortalClient.Captcha captcha(UUID id) {
        connection(id);
        return portal.captcha();
    }

    public SyncResult sync(UUID id, SyncRequest req) {
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
            repo.markSynced(id, Timestamp.from(Instant.now()));
            return new SyncResult(invoices.size(), added);
        } catch (BusinessException e) {
            repo.markError(id, e.getMessage());
            throw e;
        }
    }

    private Map<String, Object> connection(UUID id) {
        var rows = repo.findRows(id);
        if (rows.isEmpty()) {
            throw BusinessException.notFound("TAX_CONNECTION_NOT_FOUND", "Không tìm thấy kết nối");
        }
        return rows.get(0);
    }
}
