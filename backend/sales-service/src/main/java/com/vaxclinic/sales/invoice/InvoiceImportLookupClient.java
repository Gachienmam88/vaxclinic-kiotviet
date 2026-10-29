package com.vaxclinic.sales.invoice;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.vaxclinic.common.error.ApiError;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.http.InternalRestClientFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Tra cứu cho "Import file" hóa đơn bằng chính JWT của người import (đúng quyền người đó):
 * danh mục bán hàng + bảng giá của chi nhánh, lô của hàng theo lô (product-service), người dùng (identity-service).
 */
@Component
public class InvoiceImportLookupClient {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Unit(UUID id, String code, String barcode, String unitName, BigDecimal conversionRate, BigDecimal price) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Product(UUID id, String name, boolean lotManaged, BigDecimal stock, String taxCode, List<Unit> units) {
    }

    /** prices: giá theo id đơn vị tính. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record PriceBook(UUID id, String name, Map<UUID, BigDecimal> prices) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Catalog(List<Product> products, List<PriceBook> priceBooks) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Lot(UUID branchId, String lotNumber, LocalDate expiryDate, BigDecimal quantity) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record User(UUID id, String fullName, String username) {
    }

    private final RestClient product;
    private final RestClient identity;

    public InvoiceImportLookupClient(InternalRestClientFactory httpFactory, @Value("${app.product-url}") String productUrl,
                                     @Value("${app.identity-url}") String identityUrl) {
        this.product = httpFactory.create(productUrl);
        this.identity = httpFactory.create(identityUrl);
    }

    public Catalog catalog(UUID branchId, String token) {
        return call("PRODUCT", () -> product.get().uri("/api/products/sale-catalog?branchId={b}&withPriceBooks=true", branchId)
                .header("Authorization", "Bearer " + token).retrieve().body(Catalog.class));
    }

    public List<Lot> lots(UUID productId, String token) {
        return call("PRODUCT", () -> product.get().uri("/api/products/{id}/lots", productId)
                .header("Authorization", "Bearer " + token).retrieve().body(new ParameterizedTypeReference<List<Lot>>() { }));
    }

    public List<User> users(String token) {
        return call("IDENTITY", () -> identity.get().uri("/api/users/lookup")
                .header("Authorization", "Bearer " + token).retrieve().body(new ParameterizedTypeReference<List<User>>() { }));
    }

    private static <T> T call(String service, Supplier<T> request) {
        try {
            T body = request.get();
            if (body == null) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, service + "_LOOKUP_FAILED", "Không tra được dữ liệu để import");
            }
            return body;
        } catch (HttpClientErrorException e) {
            ApiError err = e.getResponseBodyAs(ApiError.class);
            throw new BusinessException(HttpStatus.valueOf(e.getStatusCode().value()), err == null ? service + "_LOOKUP_FAILED" : err.code(),
                    err == null ? "Không tra được dữ liệu để import" : err.message());
        } catch (ResourceAccessException e) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, service + "_SERVICE_DOWN",
                    "Không kết nối được dịch vụ " + ("PRODUCT".equals(service) ? "hàng hóa" : "người dùng") + ", vui lòng thử lại");
        }
    }
}
