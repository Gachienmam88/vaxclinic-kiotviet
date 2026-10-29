package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.common.error.ApiError;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.security.ServiceTokenProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Gọi product-service /internal/stock-docs để trừ / hoàn kho. Idempotent theo (docId, docType) phía product-service,
 * nên gọi lại sau lỗi mạng hoặc khi đồng bộ hóa đơn offline là an toàn.
 */
@Component
public class ProductStockClient {

    /**
     * Bán: unitId + quantity. Trả hàng: lotNumber + baseQuantity (đơn vị cơ bản);
     * expiryDate: trả nhanh nhập lô mới (lô đã có tại chi nhánh thì phải trùng hạn).
     */
    public record Line(UUID lineId, UUID productId, UUID unitId, BigDecimal quantity, String lotNumber,
                       BigDecimal baseQuantity, LocalDate expiryDate) {
        public Line(UUID lineId, UUID productId, UUID unitId, BigDecimal quantity, String lotNumber,
                    BigDecimal baseQuantity) {
            this(lineId, productId, unitId, quantity, lotNumber, baseQuantity, null);
        }

        public static Line sale(UUID lineId, UUID productId, UUID unitId, BigDecimal quantity) {
            return new Line(lineId, productId, unitId, quantity, null, null);
        }
    }

    /** previousDocId: chỉ dùng cho SALE_REPLACE (sửa hóa đơn) — chứng từ kho đang hiệu lực cần hoàn lại. */
    public record Request(UUID docId, String docType, String docCode, UUID branchId, String partnerName, UUID userId,
                          UUID previousDocId, List<Line> lines) {
    }

    public record Allocation(String lotNumber, LocalDate expiryDate, BigDecimal baseQuantity) {
    }

    public record LineResult(UUID lineId, UUID productId, BigDecimal unitCost, BigDecimal conversionRate,
                             List<Allocation> allocations) {
    }

    public record Result(UUID docId, String docType, List<LineResult> lines) {
    }

    private final RestClient http;
    private final ServiceTokenProvider tokens;

    public ProductStockClient(InternalRestClientFactory httpFactory, @Value("${app.http.stock-read-timeout:10s}") Duration stockReadTimeout,
                          @Value("${app.product-url}") String productUrl, @Value("${app.jwt.secret}") String secret) {
        this.http = httpFactory.create(productUrl, stockReadTimeout);
        this.tokens = new ServiceTokenProvider(secret, "sales-service");
    }

    /** Dòng của hóa đơn gộp: lineId mới, sourceLineId = dòng của hóa đơn gốc (kho xuất lại đúng lô của dòng gốc). */
    public record MergeLine(UUID lineId, UUID sourceLineId) {
    }

    /** SALE_MERGE: hoàn previousDocIds + xuất lại đúng lô cho dòng mới, 1 transaction phía product-service. */
    public record MergeRequest(UUID docId, String docType, String docCode, UUID branchId, String partnerName, UUID userId,
                               List<UUID> previousDocIds, List<MergeLine> lines) {
        public MergeRequest(UUID docId, String docCode, UUID branchId, String partnerName, UUID userId,
                            List<UUID> previousDocIds, List<MergeLine> lines) {
            this(docId, "SALE_MERGE", docCode, branchId, partnerName, userId, previousDocIds, lines);
        }
    }

    public Result apply(Request req) {
        return post(req);
    }

    /** Gộp hóa đơn — idempotent theo docId như các chứng từ khác. */
    public Result applyMerge(MergeRequest req) {
        return post(req);
    }

    private Result post(Object req) {
        try {
            return http.post().uri("/internal/stock-docs").header("Authorization", "Bearer " + tokens.token())
                    .body(req).retrieve().body(Result.class);
        } catch (HttpClientErrorException e) {
            // Lỗi nghiệp vụ từ product-service (thiếu tồn, hàng không tồn tại...) → chuyển nguyên thông báo cho người dùng
            ApiError err = e.getResponseBodyAs(ApiError.class);
            throw new BusinessException(HttpStatus.BAD_REQUEST, err == null ? "STOCK_ERROR" : err.code(),
                    err == null ? "Lỗi cập nhật kho" : err.message());
        } catch (ResourceAccessException e) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "STOCK_SERVICE_DOWN",
                    "Không kết nối được dịch vụ kho, vui lòng thử lại");
        }
    }
}
