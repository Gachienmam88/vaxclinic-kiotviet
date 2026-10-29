package com.vaxclinic.sales.order;

import org.springframework.stereotype.Service;

import java.util.Map;

/** "Xử lý đặt hàng" ở màn bán hàng: tìm đơn còn xử lý được, tối đa 50 dòng / trang. */
@Service
public class OrderSaleSearchService {

    private final OrderSaleSearchRepository repo;

    public OrderSaleSearchService(OrderSaleSearchRepository repo) {
        this.repo = repo;
    }

    /** Kết quả {items, total}. */
    public Map<String, Object> search(OrderSaleSearchRepository.Filter filter, int page, int size) {
        int limit = Math.min(Math.max(size, 1), 50);
        var r = repo.search(filter, limit, (long) Math.max(page, 0) * limit);
        return Map.of("items", r.items(), "total", r.total());
    }
}
