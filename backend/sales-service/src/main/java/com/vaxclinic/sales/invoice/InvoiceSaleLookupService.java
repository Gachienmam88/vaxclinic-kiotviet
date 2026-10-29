package com.vaxclinic.sales.invoice;

import com.vaxclinic.sales.invoice.InvoiceSaleLookupRepository.LastPrice;
import com.vaxclinic.sales.invoice.InvoiceSaleLookupRepository.ReturnableFilter;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Tra cứu hóa đơn ở màn bán hàng: giá bán gần nhất cho khách, "Chọn hóa đơn trả hàng" (tối đa 50 dòng / trang). */
@Service
public class InvoiceSaleLookupService {

    private final InvoiceSaleLookupRepository repo;

    public InvoiceSaleLookupService(InvoiceSaleLookupRepository repo) {
        this.repo = repo;
    }

    public List<LastPrice> lastPrices(UUID customerId, List<UUID> productIds) {
        return repo.lastPrices(customerId, productIds);
    }

    /** Kết quả {items, total}. */
    public Map<String, Object> returnable(ReturnableFilter filter, int page, int size) {
        int limit = Math.min(Math.max(size, 1), 50);
        var r = repo.returnable(filter, limit, (long) Math.max(page, 0) * limit);
        return Map.of("items", r.items(), "total", r.total());
    }
}
