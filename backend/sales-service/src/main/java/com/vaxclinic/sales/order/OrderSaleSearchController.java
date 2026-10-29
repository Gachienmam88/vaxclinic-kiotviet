package com.vaxclinic.sales.order;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * "Xử lý đặt hàng" ở màn bán hàng: đơn còn xử lý được (Phiếu tạm DRAFT / Đã xác nhận CONFIRMED — xem CustomerOrder.isOpen),
 * lọc theo mã / khách / ghi chú / hàng / thời gian đặt / chi nhánh, mới nhất trước. Nghiệp vụ ở {@link OrderSaleSearchService}.
 */
@RestController
@PreAuthorize("hasAuthority('sales.perform')")
public class OrderSaleSearchController {

    private final OrderSaleSearchService service;

    public OrderSaleSearchController(OrderSaleSearchService service) {
        this.service = service;
    }

    @GetMapping("/api/orders/sale-search")
    public Map<String, Object> search(@RequestParam(required = false) String code,
                                      @RequestParam(required = false) String customer,
                                      @RequestParam(required = false) String note,
                                      @RequestParam(required = false) String productCode,
                                      @RequestParam(required = false) String productName,
                                      @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
                                      @RequestParam(required = false) UUID branchId,
                                      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return service.search(new OrderSaleSearchRepository.Filter(code, customer, note, productCode, productName, from, to,
                branchId), page, size);
    }
}
