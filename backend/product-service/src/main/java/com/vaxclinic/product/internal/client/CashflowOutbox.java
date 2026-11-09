package com.vaxclinic.product.internal.client;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.common.kafka.KafkaProducers;
import com.vaxclinic.common.security.ServiceTokenProvider;
import com.vaxclinic.product.purchase.entity.PurchaseReceipt;
import com.vaxclinic.product.purchase.entity.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Outbox pattern: ghi "phiếu chi trả NCC" vào bảng outbox CÙNG transaction với phiếu nhập,
 * rồi job nền gửi sang Sổ quỹ (sales-service /internal/cashflows) tới khi thành công.
 * Sổ quỹ nhận idempotent theo (sourceType, sourceId, action) nên gửi lặp không tạo phiếu trùng.
 * <p>
 * Kênh gửi (app.cashflow.transport): http = POST /internal/cashflows (mặc định);
 * kafka = topic {@value #TOPIC}, key = sourceId (mọi bản tin của 1 chứng từ vào cùng partition → giữ thứ tự),
 * chờ Kafka xác nhận rồi mới đánh dấu đã gửi. sales-service đọc topic và ghi Sổ quỹ.
 */
@Component
public class CashflowOutbox implements DisposableBean {

    public static final String TOPIC = "cashflow.events";

    private static final Logger log = LoggerFactory.getLogger(CashflowOutbox.class);

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final RestClient http;
    private final ServiceTokenProvider tokens;
    /** null = gửi HTTP. */
    private final KafkaTemplate<String, String> kafka;

    public CashflowOutbox(InternalRestClientFactory httpFactory, JdbcTemplate jdbc, ObjectMapper json, @Value("${app.sales-url}") String salesUrl,
                          @Value("${app.jwt.secret}") String secret,
                          @Value("${app.cashflow.transport:http}") String transport,
                          @Value("${spring.kafka.bootstrap-servers:localhost:9094}") String kafkaServers) {
        this.jdbc = jdbc;
        this.json = json;
        this.http = httpFactory.create(salesUrl);
        this.tokens = new ServiceTokenProvider(secret, "product-service");
        this.kafka = "kafka".equalsIgnoreCase(transport.trim()) ? KafkaProducers.reliable(kafkaServers, "product-service-cashflow") : null;
        log.info("Cashflow outbox transport: {}", kafka == null ? "http" : "kafka (" + TOPIC + ")");
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
            jdbc.update("insert into outbox_cashflows(id, payload) values (?, ?)", UUID.randomUUID(),
                    json.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Gửi lần lượt theo thứ tự tạo; dừng ở bản ghi lỗi đầu tiên để giữ đúng thứ tự CREATE → CANCEL. */
    @Scheduled(fixedDelayString = "${app.outbox-delay-ms:5000}")
    public void publish() {
        var pending = jdbc.queryForList(
                "select id, payload from outbox_cashflows where sent_at is null order by created_at limit 50");
        for (var row : pending) {
            UUID id = (UUID) row.get("id");
            try {
                deliver((String) row.get("payload"));
                jdbc.update("update outbox_cashflows set sent_at = now(), last_error = null where id = ?", id);
            } catch (Exception e) {
                jdbc.update("update outbox_cashflows set attempts = attempts + 1, last_error = ? where id = ?",
                        e.getMessage(), id);
                log.warn("Cashflow outbox {} not delivered yet: {}", id, e.getMessage());
                return;
            }
        }
    }

    private void deliver(String payload) throws Exception {
        if (kafka == null) {
            http.post().uri("/internal/cashflows").header("Authorization", "Bearer " + tokens.token())
                    .header("Content-Type", "application/json").body(payload)
                    .retrieve().toBodilessEntity();
            return;
        }
        String key = json.readTree(payload).path("sourceId").asText(null);
        kafka.send(TOPIC, key, payload).get(35, TimeUnit.SECONDS); // chờ ack (acks=all) — lỗi thì giữ lại, lần sau gửi tiếp
    }

    @Override
    public void destroy() {
        if (kafka != null) {
            kafka.getProducerFactory().reset();
        }
    }
}
