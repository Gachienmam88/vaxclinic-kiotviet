package com.vaxclinic.identity.hr;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.common.security.ServiceTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.UUID;

/**
 * Outbox: phiếu chi trả lương / tạm ứng ghi vào bảng outbox CÙNG transaction với nghiệp vụ, job nền gửi sang Sổ quỹ
 * (sales-service /internal/cashflows) tới khi thành công. Sổ quỹ nhận idempotent theo (sourceType, sourceId).
 */
@Component
public class HrCashflowOutbox {

    /** Phiếu chi gửi Sổ quỹ. sourceId: id thanh toán lương / id tạm ứng. fund: CASH / BANK. */
    public record Payment(String sourceType, UUID sourceId, String code, String fund, String category, BigDecimal amount,
                          Instant occurredAt, UUID branchId, UUID employeeId, String employeeName, String employeePhone,
                          HrActor actor, String note) {
    }

    private static final Logger log = LoggerFactory.getLogger(HrCashflowOutbox.class);

    private final HrCashflowOutboxRepository repo;
    private final ObjectMapper json;
    private final RestClient http;
    private final ServiceTokenProvider tokens;

    public HrCashflowOutbox(InternalRestClientFactory httpFactory, HrCashflowOutboxRepository repo, ObjectMapper json, @Value("${app.sales-url}") String salesUrl,
                            @Value("${app.jwt.secret}") String secret) {
        this.repo = repo;
        this.json = json;
        this.http = httpFactory.create(salesUrl);
        this.tokens = new ServiceTokenProvider(secret, "identity-service");
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void paid(Payment p) {
        if (p.amount().signum() <= 0) {
            return;
        }
        var m = new LinkedHashMap<String, Object>();
        m.put("action", "CREATE");
        m.put("sourceType", p.sourceType());
        m.put("sourceId", p.sourceId());
        m.put("code", p.code());
        m.put("voucherType", "PAYMENT");
        m.put("fund", p.fund());
        m.put("category", p.category());
        m.put("amount", p.amount());
        m.put("occurredAt", p.occurredAt());
        m.put("branchId", p.branchId());
        m.put("partnerType", "EMPLOYEE");
        m.put("partnerId", p.employeeId());
        m.put("partnerName", p.employeeName());
        m.put("partnerPhone", p.employeePhone());
        m.put("userId", p.actor().id());
        m.put("userName", p.actor().name());
        m.put("note", p.note());
        insert(m);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void cancelled(String sourceType, UUID sourceId) {
        var m = new LinkedHashMap<String, Object>();
        m.put("action", "CANCEL");
        m.put("sourceType", sourceType);
        m.put("sourceId", sourceId);
        insert(m);
    }

    private void insert(Object payload) {
        try {
            repo.insert(json.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Gửi theo thứ tự tạo; dừng ở bản ghi lỗi đầu tiên để giữ đúng thứ tự CREATE → CANCEL. */
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
