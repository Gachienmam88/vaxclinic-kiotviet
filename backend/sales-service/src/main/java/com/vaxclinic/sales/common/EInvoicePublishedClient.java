package com.vaxclinic.sales.common;

import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.security.ServiceTokenProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Map;
import java.util.UUID;

/** Hỏi integration-service hóa đơn đã phát hành hóa đơn điện tử chưa. Không hỏi được → lỗi EINVOICE_SERVICE_DOWN. */
@Component
public class EInvoicePublishedClient {

    private final RestClient integration;
    private final ServiceTokenProvider tokens;

    public EInvoicePublishedClient(InternalRestClientFactory httpFactory, @Value("${app.integration-url}") String integrationUrl,
                                   @Value("${app.jwt.secret}") String secret) {
        this.integration = httpFactory.create(integrationUrl);
        this.tokens = new ServiceTokenProvider(secret, "sales-service");
    }

    public boolean isPublished(UUID invoiceId) {
        Map<?, ?> res;
        try {
            res = integration.get().uri("/internal/einvoices/{id}/published", invoiceId)
                    .header("Authorization", "Bearer " + tokens.token()).retrieve().body(Map.class);
        } catch (RestClientException e) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "EINVOICE_SERVICE_DOWN",
                    "Không kiểm tra được trạng thái hóa đơn điện tử, vui lòng thử lại");
        }
        return res != null && Boolean.TRUE.equals(res.get("published"));
    }
}
