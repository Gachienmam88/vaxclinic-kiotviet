package com.vaxclinic.sales.salesreturn;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.common.error.ApiError;
import com.vaxclinic.common.error.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Đọc hàng hóa từ product-service (GET /api/products/{id}, quyền catalog.view) bằng chính JWT của người đang thao tác —
 * product-service chưa có API nội bộ tra hàng. Dùng cho "Trả nhanh": tỷ lệ quy đổi đơn vị lấy từ đây, không tin client.
 */
@Component
public class ProductCatalogClient {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Unit(UUID id, String code, String unitName, BigDecimal conversionRate) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Product(UUID id, String name, boolean lotManaged, boolean active, List<Unit> units) {
    }

    private final RestClient http;

    public ProductCatalogClient(InternalRestClientFactory httpFactory, @Value("${app.product-url}") String productUrl) {
        this.http = httpFactory.create(productUrl);
    }

    public Product get(UUID productId, String bearerToken) {
        if (bearerToken == null || bearerToken.isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "TOKEN_REQUIRED", "Thiếu phiên đăng nhập để tra hàng hóa");
        }
        try {
            Product p = http.get().uri("/api/products/{id}", productId).header("Authorization", "Bearer " + bearerToken)
                    .retrieve().body(Product.class);
            if (p == null) {
                throw BusinessException.badRequest("PRODUCT_NOT_FOUND", "Hàng hóa không tồn tại");
            }
            return p;
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode().value() == 404) {
                throw BusinessException.badRequest("PRODUCT_NOT_FOUND", "Hàng hóa không tồn tại");
            }
            ApiError err = e.getResponseBodyAs(ApiError.class);
            throw new BusinessException(HttpStatus.valueOf(e.getStatusCode().value()), err == null ? "PRODUCT_LOOKUP_FAILED" : err.code(),
                    err == null ? "Không tra được hàng hóa" : err.message());
        } catch (ResourceAccessException e) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "PRODUCT_SERVICE_DOWN",
                    "Không kết nối được dịch vụ hàng hóa, vui lòng thử lại");
        }
    }
}
