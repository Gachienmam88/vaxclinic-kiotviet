package com.vaxclinic.sales.invoice.checkout;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.sales.invoice.ProductStockClient;
import org.springframework.http.HttpStatus;

import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Kho giả cho test: mỗi SALE trừ 1, SALE_CANCEL hoàn 1; chống trùng theo (docId, docType) như external_stock_docs của
 * product-service (gửi lại → trả kết quả cũ, không đổi tồn). down = true → như product-service không phản hồi.
 */
class FakeStock extends ProductStockClient {

    int quantity;
    boolean down;
    private final Set<String> applied = new HashSet<>();

    FakeStock(int quantity) {
        super(InternalRestClientFactory.defaults(), Duration.ofSeconds(1), "http://127.0.0.1:9",
                "test-secret-test-secret-test-secret-0123456789");
        this.quantity = quantity;
    }

    @Override
    public Result apply(Request req) {
        if (down) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "STOCK_SERVICE_DOWN", "down");
        }
        Result result = new Result(req.docId(), req.docType(), List.of());
        if (!applied.add(req.docId() + "|" + req.docType())) {
            return result;
        }
        switch (req.docType()) {
            case "SALE" -> quantity--;
            case "SALE_CANCEL" -> {
                if (!applied.contains(req.docId() + "|SALE")) {
                    applied.remove(req.docId() + "|SALE_CANCEL");
                    throw BusinessException.badRequest("STOCK_DOC_NOT_FOUND", "Không tìm thấy chứng từ kho gốc");
                }
                quantity++;
            }
            default -> throw new IllegalArgumentException(req.docType());
        }
        return result;
    }
}
