package com.vaxclinic.identity.hr.client;

import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.common.security.ServiceTokenProvider;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.common.kafka.KafkaProducers;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Gửi phiếu chi (payload JSON từ outbox) sang Sổ quỹ — sales-service /internal/cashflows. Lỗi ném nguyên cho {@link HrCashflowOutbox}. */
@Component
public class SalesCashflowClient implements DisposableBean {

    /** Cùng topic với phiếu chi trả NCC (product-service); sales-service CashflowEventConsumer ghi Sổ quỹ. */
    public static final String TOPIC = "cashflow.events";

    private final RestClient http;
    private final ServiceTokenProvider tokens;
    private final ObjectMapper json;
    /** null = gửi HTTP (app.cashflow.transport=http, mặc định). */
    private final KafkaTemplate<String, String> kafka;

    public SalesCashflowClient(InternalRestClientFactory httpFactory, @Value("${app.sales-url}") String salesUrl,
                               @Value("${app.jwt.secret}") String secret, ObjectMapper json,
                               @Value("${app.cashflow.transport:http}") String transport,
                               @Value("${spring.kafka.bootstrap-servers:localhost:9094}") String kafkaServers) {
        this.http = httpFactory.create(salesUrl);
        this.tokens = new ServiceTokenProvider(secret, "identity-service");
        this.json = json;
        this.kafka = "kafka".equalsIgnoreCase(transport.trim()) ? KafkaProducers.reliable(kafkaServers, "identity-service-cashflow") : null;
    }

    /** Ném lỗi nếu chưa gửi được (outbox giữ lại, lần sau gửi tiếp). Kafka: chờ ack, key = sourceId (giữ thứ tự chứng từ). */
    public void send(String payload) throws Exception {
        if (kafka != null) {
            kafka.send(TOPIC, json.readTree(payload).path("sourceId").asText(null), payload).get(35, java.util.concurrent.TimeUnit.SECONDS);
            return;
        }
        http.post().uri("/internal/cashflows").header("Authorization", "Bearer " + tokens.token())
                .header("Content-Type", "application/json").body(payload)
                .retrieve().toBodilessEntity();
    }

    @Override
    public void destroy() {
        if (kafka != null) {
            kafka.getProducerFactory().reset();
        }
    }
}
