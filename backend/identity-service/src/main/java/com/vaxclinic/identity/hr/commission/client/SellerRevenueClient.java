package com.vaxclinic.identity.hr.commission.client;

import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.security.ServiceTokenProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Doanh thu theo người bán × mặt hàng trong kỳ (sales-service /internal/seller-revenue): hóa đơn hoàn thành − hàng trả,
 * netRevenue = sau phân bổ giảm giá hóa đơn, paidRevenue = phần khách đã trả (thực thu). sellerId = id tài khoản người dùng.
 */
@Component
public class SellerRevenueClient {

    public record SellerRevenue(UUID sellerId, UUID productId, String productCode, String productName, BigDecimal quantity,
                                BigDecimal netRevenue, BigDecimal paidRevenue) {
    }

    private final RestClient http;
    private final ServiceTokenProvider tokens;

    public SellerRevenueClient(InternalRestClientFactory httpFactory, @Value("${app.sales-url}") String salesUrl, @Value("${app.jwt.secret}") String secret) {
        this.http = httpFactory.create(salesUrl);
        this.tokens = new ServiceTokenProvider(secret, "identity-service");
    }

    public List<SellerRevenue> revenue(LocalDate from, LocalDate to) {
        try {
            List<SellerRevenue> r = http.get().uri(u -> u.path("/internal/seller-revenue").queryParam("from", from).queryParam("to", to).build())
                    .header("Authorization", "Bearer " + tokens.token()).retrieve()
                    .body(new ParameterizedTypeReference<List<SellerRevenue>>() { });
            return r == null ? List.of() : r;
        } catch (RestClientException e) {
            throw BusinessException.badRequest("SALES_UNAVAILABLE",
                    "Không lấy được doanh thu bán hàng để tính hoa hồng, thử lại sau (" + e.getMessage() + ")");
        }
    }
}
