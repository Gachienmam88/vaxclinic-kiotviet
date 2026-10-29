package com.vaxclinic.sales.invoice;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.common.security.ServiceTokenProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Dữ liệu tính "Giảm thuế" do server tự tra (không tin máy bán hàng): thông tin thuế của hàng (product-service
 * /internal/products/tax-info) và thiết lập thuế — phương pháp, ngành nghề, nhóm hàng → ngành (identity-service
 * /internal/settings/tax). Gọi bằng JWT dịch vụ quyền "internal"; gateway không route /internal/**.
 */
@Component
public class TaxReductionLookupClient {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ProductTax(UUID productId, String taxCode, boolean taxReduction, List<UUID> categoryPath) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Sector(String code, BigDecimal vatRate) {
    }

    /** vatMethod: DEDUCTION (khấu trừ) / DIRECT (trực tiếp trên doanh thu). */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TaxSettings(List<Sector> sectors, String defaultSector, Map<UUID, String> categorySectors, String vatMethod) {
    }

    private final RestClient product;
    private final RestClient identity;
    private final ServiceTokenProvider tokens;

    public TaxReductionLookupClient(InternalRestClientFactory httpFactory, @Value("${app.product-url}") String productUrl,
                                    @Value("${app.identity-url}") String identityUrl, @Value("${app.jwt.secret}") String secret) {
        this.product = httpFactory.create(productUrl);
        this.identity = httpFactory.create(identityUrl);
        this.tokens = new ServiceTokenProvider(secret, "sales-service");
    }

    public List<ProductTax> products(Collection<UUID> ids) {
        try {
            List<ProductTax> r = product.post().uri("/internal/products/tax-info").header("Authorization", "Bearer " + tokens.token())
                    .body(Map.of("productIds", List.copyOf(ids))).retrieve().body(new ParameterizedTypeReference<List<ProductTax>>() { });
            return r == null ? List.of() : r;
        } catch (RestClientException e) {
            throw down("hàng hóa");
        }
    }

    public TaxSettings settings() {
        try {
            return identity.get().uri("/internal/settings/tax").header("Authorization", "Bearer " + tokens.token())
                    .retrieve().body(TaxSettings.class);
        } catch (RestClientException e) {
            throw down("thiết lập thuế");
        }
    }

    private static BusinessException down(String what) {
        return new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "TAX_LOOKUP_DOWN",
                "Không tra được " + what + " để tính giảm thuế, vui lòng thử lại");
    }
}
