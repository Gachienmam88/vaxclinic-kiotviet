package com.vaxclinic.integration.inputinvoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.integration.common.SecretCipher;
import com.vaxclinic.integration.inputinvoice.TaxConnectionController.ConnectionRequest;
import com.vaxclinic.integration.inputinvoice.TaxConnectionController.SyncRequest;
import com.vaxclinic.integration.inputinvoice.TaxConnectionRepository.ConnectionResponse;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Hóa đơn đầu vào → "Danh sách kết nối" (tài khoản cổng thuế theo MST, mật khẩu mã hóa AES-GCM) + đồng bộ.
 * Đồng bộ 2 bước: (1) captcha lấy ảnh captcha, (2) sync gửi mã người dùng nhập + khoảng ngày.
 */
@Service
public class TaxConnectionService {

    private final TaxConnectionRepository connections;
    private final SecretCipher cipher;
    private final GdtPortalClient portal;
    private final InputInvoiceWriteRepository store;

    public TaxConnectionService(TaxConnectionRepository connections, SecretCipher cipher, GdtPortalClient portal,
                                InputInvoiceWriteRepository store) {
        this.connections = connections;
        this.cipher = cipher;
        this.portal = portal;
        this.store = store;
    }

    public List<ConnectionResponse> list() {
        return connections.findAll();
    }

    public Map<String, UUID> create(ConnectionRequest req) {
        if (req.password() == null || req.password().isBlank()) {
            throw BusinessException.badRequest("PASSWORD_REQUIRED", "Nhập mật khẩu tài khoản cổng thuế");
        }
        UUID id = UUID.randomUUID();
        try {
            connections.insert(id, req.taxCode().trim(), req.username().trim(), cipher.encrypt(req.password()));
        } catch (DuplicateKeyException e) {
            throw BusinessException.conflict("TAX_CONNECTION_EXISTS", "Mã số thuế này đã được kết nối");
        }
        return Map.of("id", id);
    }

    /** Sửa thiết lập; để trống mật khẩu = giữ mật khẩu cũ. */
    public void update(UUID id, ConnectionRequest req) {
        String enc = req.password() == null || req.password().isBlank() ? null : cipher.encrypt(req.password());
        if (connections.update(id, req.taxCode().trim(), req.username().trim(), enc) == 0) {
            throw BusinessException.notFound("TAX_CONNECTION_NOT_FOUND", "Không tìm thấy kết nối");
        }
    }

    public void delete(UUID id) {
        connections.delete(id);
    }

    public GdtPortalClient.Captcha captcha(UUID id) {
        connection(id);
        return portal.captcha();
    }

    /** Mỗi lần tối đa 1 tháng; lỗi cổng thuế được ghi vào last_error của kết nối rồi ném lại. */
    public Map<String, Integer> sync(UUID id, SyncRequest req) {
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
                var parsed = InputInvoiceWriteRepository.fromPortal(s, portal.detail(token, s, sco));
                if (store.upsert(parsed, (String) c.get("tax_code"), "PORTAL")) {
                    added++;
                }
            }
            connections.markSynced(id, Instant.now());
            return Map.of("found", invoices.size(), "added", added);
        } catch (BusinessException e) {
            connections.markError(id, e.getMessage());
            throw e;
        }
    }

    private Map<String, Object> connection(UUID id) {
        var c = connections.findById(id);
        if (c == null) {
            throw BusinessException.notFound("TAX_CONNECTION_NOT_FOUND", "Không tìm thấy kết nối");
        }
        return c;
    }
}
