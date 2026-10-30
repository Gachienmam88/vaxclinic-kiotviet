package com.vaxclinic.sales.cashbook;

import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.common.security.ServiceTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.UUID;

/**
 * Chứng từ đã lập từ hóa đơn đầu vào bị hủy → báo integration-service bỏ "Đã lập phiếu" (DELETE
 * /internal/input-invoices/links/{docId}). Gọi SAU khi đã commit, best-effort: integration-service lỗi / tắt thì chỉ ghi log,
 * không chặn việc hủy (hóa đơn còn "Đã lập phiếu" tới khi bỏ liên kết lại).
 */
@Component
public class InputInvoiceUnlinkClient {

    private static final Logger log = LoggerFactory.getLogger(InputInvoiceUnlinkClient.class);

    private final RestClient integration;
    private final ServiceTokenProvider tokens;

    public InputInvoiceUnlinkClient(InternalRestClientFactory httpFactory, @Value("${app.integration-url}") String integrationUrl,
                                    @Value("${app.jwt.secret}") String secret) {
        this.integration = httpFactory.create(integrationUrl);
        this.tokens = new ServiceTokenProvider(secret, "sales-service");
    }

    public void docCancelled(UUID docId) {
        try {
            integration.delete().uri("/internal/input-invoices/links/{docId}", docId)
                    .header("Authorization", "Bearer " + tokens.token()).retrieve().toBodilessEntity();
        } catch (Exception e) {
            log.warn("Could not unlink input invoice for cancelled doc {}: {}", docId, e.getMessage());
        }
    }
}
