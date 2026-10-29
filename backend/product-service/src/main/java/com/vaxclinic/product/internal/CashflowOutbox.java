package com.vaxclinic.product.internal;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.common.security.ServiceTokenProvider;
import com.vaxclinic.product.purchase.PurchaseReceipt;
import com.vaxclinic.product.purchase.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.UUID;

/**
 * Outbox pattern: ghi "phiếu chi trả NCC" vào bảng outbox CÙNG transaction với phiếu nhập,
 * rồi job nền gửi sang Sổ quỹ (sales-service /internal/cashflows) tới khi thành công.
 * Sổ quỹ nhận idempotent theo (sourceType, sourceId, action) nên gửi lặp không tạo phiếu trùng.
 */
@Component
public class CashflowOutbox {

    private static final Logger log = LoggerFactory.getLogger(CashflowOutbox.class);

    private final CashflowOutboxRepository repo;
    private final ObjectMapper json;
    private final RestClient http;
    private final ServiceTokenProvider tokens;

    public CashflowOutbox(InternalRestClientFactory httpFactory, CashflowOutboxRepository repo, ObjectMapper json, @Value("${app.sales-url}") String salesUrl,
                          @Value("${app.jwt.secret}") String secret) {
        this.repo = repo;
        this.json = json;
        this.http = httpFactory.create(salesUrl);
        this.tokens = new ServiceTokenProvider(secret, "product-service");
    }

    /** Phiếu nhập hoàn thành có trả tiền NCC → phiếu chi PC{mã phiếu nhập}. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void receiptPaid(PurchaseReceipt r, Supplier s) {
        if (r.getPaidAmount().signum() <= 0) {
            return;
        }
        var p = new LinkedHashMap<String, Object>();
        p.put("action", "CREATE");
        p.put("sourceType", "PURCHASE");
        p.put("sourceId", r.getId());
        p.put("code", "PC" + r.getCode());
        p.put("voucherType", "PAYMENT");
        p.put("fund", "TRANSFER".equals(r.getPaymentMethod()) ? "BANK" : "CASH");
        p.put("category", "Chi Tiền trả NCC");
        p.put("amount", r.getPaidAmount());
        p.put("occurredAt", r.getReceivedAt());
        p.put("branchId", r.getBranchId());
        p.put("partnerType", "SUPPLIER");
        p.put("partnerId", r.getSupplierId());
        p.put("partnerName", s == null ? null : s.getName());
        p.put("partnerPhone", s == null ? null : s.getPhone());
        p.put("userId", r.getReceiverId() == null ? r.getCreatedBy() : r.getReceiverId());
        p.put("userName", r.getReceiverName() == null ? r.getCreatedByName() : r.getReceiverName());
        p.put("note", "Thanh toán phiếu nhập " + r.getCode());
        insert(p);
    }

    /** Hủy phiếu nhập đã trả tiền → hủy phiếu chi tương ứng. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void receiptCancelled(PurchaseReceipt r) {
        if (r.getPaidAmount().compareTo(BigDecimal.ZERO) > 0) {
            var p = new LinkedHashMap<String, Object>();
            p.put("action", "CANCEL");
            p.put("sourceType", "PURCHASE");
            p.put("sourceId", r.getId());
            insert(p);
        }
    }

    /** Đổi ngày nhập phiếu đã hoàn thành → phiếu chi PC{mã PN} ở Sổ quỹ đổi ngày (Sổ quỹ bỏ qua nếu không có phiếu). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void receiptRedated(PurchaseReceipt r) {
        supplierPaymentUpdated(r.getId(), r.getReceivedAt(), r.getReceiverId() == null ? r.getCreatedBy() : r.getReceiverId(),
                r.getReceiverName() == null ? r.getCreatedByName() : r.getReceiverName(), "Thanh toán phiếu nhập " + r.getCode());
    }

    /** Phiếu chi trả nợ NCC (màn Nhà cung cấp) → phiếu chi Sổ quỹ, sourceType PURCHASE + sourceId = id phiếu công nợ. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void supplierPayment(SupplierPaymentVoucher v, Supplier s) {
        var p = new LinkedHashMap<String, Object>();
        p.put("action", "CREATE");
        p.put("sourceType", "PURCHASE");
        p.put("sourceId", v.sourceId());
        p.put("code", v.code());
        p.put("voucherType", "PAYMENT");
        p.put("fund", "TRANSFER".equals(v.method()) ? "BANK" : "EWALLET".equals(v.method()) ? "EWALLET" : "CASH");
        p.put("bankAccountId", v.bankAccountId());
        p.put("category", "Chi Tiền trả NCC");
        p.put("amount", v.amount());
        p.put("occurredAt", v.occurredAt());
        p.put("branchId", v.branchId());
        p.put("partnerType", "SUPPLIER");
        p.put("partnerId", s.getId());
        p.put("partnerName", s.getName());
        p.put("partnerPhone", s.getPhone());
        p.put("userId", v.userId());
        p.put("userName", v.userName());
        p.put("note", v.note());
        insert(p);
    }

    /** Sửa thời gian / người chi / ghi chú của phiếu chi trả NCC đã gửi Sổ quỹ. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void supplierPaymentUpdated(UUID sourceId, java.time.Instant occurredAt, UUID userId, String userName, String note) {
        var p = new LinkedHashMap<String, Object>();
        p.put("action", "UPDATE");
        p.put("sourceType", "PURCHASE");
        p.put("sourceId", sourceId);
        p.put("occurredAt", occurredAt);
        p.put("userId", userId);
        p.put("userName", userName);
        p.put("note", note);
        insert(p);
    }

    /** Hủy phiếu chi trả NCC → hủy phiếu chi Sổ quỹ tương ứng. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void supplierPaymentCancelled(UUID sourceId) {
        var p = new LinkedHashMap<String, Object>();
        p.put("action", "CANCEL");
        p.put("sourceType", "PURCHASE");
        p.put("sourceId", sourceId);
        insert(p);
    }

    public record SupplierPaymentVoucher(UUID sourceId, String code, String method, UUID bankAccountId, BigDecimal amount,
                                         java.time.Instant occurredAt, UUID branchId, UUID userId, String userName,
                                         String note) {
    }

    private void insert(Object payload) {
        try {
            repo.insert(json.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Gửi lần lượt theo thứ tự tạo; dừng ở bản ghi lỗi đầu tiên để giữ đúng thứ tự CREATE → CANCEL. */
    @Scheduled(fixedDelayString = "${app.outbox-delay-ms:5000}")
    public void publish() {
        var pending = repo.pending();
        for (var row : pending) {
            UUID id = (UUID) row.get("id");
            try {
                http.post().uri("/internal/cashflows").header("Authorization", "Bearer " + tokens.token())
                        .header("Content-Type", "application/json").body((String) row.get("payload"))
                        .retrieve().toBodilessEntity();
                repo.markSent(id);
            } catch (Exception e) {
                repo.markFailed(id, e.getMessage());
                log.warn("Cashflow outbox {} not delivered yet: {}", id, e.getMessage());
                return;
            }
        }
    }
}
