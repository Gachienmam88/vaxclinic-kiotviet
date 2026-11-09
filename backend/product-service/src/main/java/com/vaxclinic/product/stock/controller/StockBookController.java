package com.vaxclinic.product.stock.controller;

import com.vaxclinic.product.stock.service.StockBookQuery;
import com.vaxclinic.product.stock.service.StockBookQuery.ProductCategory;
import com.vaxclinic.product.stock.service.StockBookQuery.StockBookLine;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Sổ chi tiết vật liệu, dụng cụ, sản phẩm, hàng hóa (S2d-HKD): tồn đầu kỳ, nhập, xuất, tồn cuối kỳ theo đơn vị cơ bản.
 * Giá trị: chứng từ với nhà cung cấp (nhập, trả hàng nhập, tồn đầu) tính theo giá giao dịch; còn lại theo giá vốn lúc phát sinh.
 */
@RestController
public class StockBookController {

    private final StockBookQuery query;

    public StockBookController(StockBookQuery query) {
        this.query = query;
    }

    /** Nhóm hàng của mọi mặt hàng (kể cả đã xóa) — để xếp doanh thu vào ngành nghề theo nhóm hàng. */
    @GetMapping("/api/accounting/stock/product-categories")
    @PreAuthorize("hasAuthority('report.view') or hasAuthority('cashbook.manage')")
    public List<ProductCategory> productCategories() {
        return query.productCategories();
    }

    @GetMapping("/api/accounting/stock/summary")
    @PreAuthorize("hasAuthority('report.view') or hasAuthority('inventory.view')")
    public List<StockBookLine> summary(@RequestParam LocalDate from, @RequestParam LocalDate to,
                                       @RequestParam(required = false) List<UUID> branchIds) {
        return query.summary(from, to, branchIds);
    }
}
