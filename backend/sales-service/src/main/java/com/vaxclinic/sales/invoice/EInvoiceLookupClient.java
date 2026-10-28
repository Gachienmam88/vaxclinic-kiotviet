package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.security.ServiceTokenProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.ArrayList;

/**
 * Hỏi integration-service danh sách hóa đơn đã có bản ghi HĐĐT, nhóm theo trạng thái (PUBLISHED / ACCEPTED / FAILED)
 * → lọc "Trạng thái HĐĐT", "Tính chất hóa đơn" ở danh sách hóa đơn. Chỉ gọi khi người dùng chọn các bộ lọc đó.
 */
@Component
public class EInvoiceLookupClient {

    private final RestClient integration;
    private final ServiceTokenProvider tokens;

    public EInvoiceLookupClient(InternalRestClientFactory httpFactory, @Value("${app.integration-url}") String integrationUrl, @Value("${app.jwt.secret}") String secret) {
        this.integration = httpFactory.create(integrationUrl);
        this.tokens = new ServiceTokenProvider(secret, "sales-service");
    }

    public Map<String, List<UUID>> idsByStatus() {
        List<Map<String, Object>> rows;
        try {
            rows = integration.get().uri("/internal/einvoices/statuses").header("Authorization", "Bearer " + tokens.token())
                    .retrieve().body(new ParameterizedTypeReference<>() { });
        } catch (RestClientException e) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "EINVOICE_SERVICE_DOWN",
                    "Không lấy được trạng thái hóa đơn điện tử, vui lòng thử lại");
        }
        var out = new HashMap<String, List<UUID>>();
        for (var r : rows == null ? List.<Map<String, Object>>of() : rows) {
            out.computeIfAbsent(String.valueOf(r.get("status")), k -> new ArrayList<>())
                    .add(UUID.fromString(String.valueOf(r.get("invoiceId"))));
        }
        return out;
    }
}
