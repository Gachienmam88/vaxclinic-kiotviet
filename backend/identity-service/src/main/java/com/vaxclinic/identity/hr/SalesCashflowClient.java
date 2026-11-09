package com.vaxclinic.identity.hr;

import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.common.security.ServiceTokenProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** Gửi phiếu chi (payload JSON từ outbox) sang Sổ quỹ — sales-service /internal/cashflows. Lỗi ném nguyên cho {@link HrCashflowOutbox}. */
@Component
public class SalesCashflowClient {

    private final RestClient http;
    private final ServiceTokenProvider tokens;

    public SalesCashflowClient(InternalRestClientFactory httpFactory, @Value("${app.sales-url}") String salesUrl,
                               @Value("${app.jwt.secret}") String secret) {
        this.http = httpFactory.create(salesUrl);
        this.tokens = new ServiceTokenProvider(secret, "identity-service");
    }

    public void send(String payload) {
        http.post().uri("/internal/cashflows").header("Authorization", "Bearer " + tokens.token())
                .header("Content-Type", "application/json").body(payload)
                .retrieve().toBodilessEntity();
    }
}
