package com.vaxclinic.product.stock;

import com.vaxclinic.product.stock.StockBookRepository.ProductCategory;
import com.vaxclinic.product.stock.StockBookRepository.StockBookLine;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

/** Sổ S2d-HKD: đổi ngày [from, to] (giờ Việt Nam) thành khoảng thời gian, đọc từ {@link StockBookRepository}. */
@Service
public class StockBookService {

    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    private final StockBookRepository repo;

    public StockBookService(StockBookRepository repo) {
        this.repo = repo;
    }

    public List<ProductCategory> productCategories() {
        return repo.productCategories();
    }

    public List<StockBookLine> summary(LocalDate from, LocalDate to, List<UUID> branchIds) {
        return repo.summary(from.atStartOfDay(VN).toInstant(), to.plusDays(1).atStartOfDay(VN).toInstant(), branchIds);
    }
}
