package com.vaxclinic.product.product.controller;

import com.vaxclinic.product.product.dto.ProductDtos;
import com.vaxclinic.product.product.service.ProductCommandService;
import com.vaxclinic.product.product.service.ProductDetailQuery;
import com.vaxclinic.product.product.service.ProductListQuery;
import com.vaxclinic.product.product.service.SaleCatalogQuery;
import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.product.pricebook.service.SalePriceBookQuery;
import com.vaxclinic.product.product.dto.ProductDtos.LedgerLine;
import com.vaxclinic.product.product.dto.ProductDtos.LotResponse;
import com.vaxclinic.product.product.dto.ProductDtos.ProductDetail;
import com.vaxclinic.product.product.dto.ProductDtos.ProductListResponse;
import com.vaxclinic.product.product.dto.ProductDtos.ProductRequest;
import com.vaxclinic.product.product.service.ProductListQuery.StockFilter;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/products")
@PreAuthorize("hasAuthority('catalog.view')")
public class ProductController {

    private final ProductCommandService commands;
    private final ProductListQuery listQuery;
    private final ProductDetailQuery detailQuery;
    private final SaleCatalogQuery saleCatalog;
    private final SalePriceBookQuery salePriceBooks;
    private final AuditLogger audit;

    public ProductController(ProductCommandService commands, ProductListQuery listQuery,
                             ProductDetailQuery detailQuery, SaleCatalogQuery saleCatalog, SalePriceBookQuery salePriceBooks,
                             AuditLogger audit) {
        this.commands = commands;
        this.listQuery = listQuery;
        this.detailQuery = detailQuery;
        this.saleCatalog = saleCatalog;
        this.salePriceBooks = salePriceBooks;
        this.audit = audit;
    }

    /** Ghi lịch sử thao tác hàng hóa. */
    private void log(Jwt jwt, String action, ProductDetail p, String detail) {
        audit.record(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"), null, "Hàng hóa", action,
                p.units().isEmpty() ? null : p.units().get(0).code(), detail);
    }

    @GetMapping
    public ProductListResponse list(@RequestParam(required = false) String q,
                                    @RequestParam(required = false) List<UUID> categoryIds,
                                    @RequestParam(required = false) List<UUID> taxRateIds,
                                    @RequestParam(required = false) Boolean taxReduction,
                                    @RequestParam(defaultValue = "ALL") StockFilter stock,
                                    @RequestParam(required = false) UUID branchId,
                                    @RequestParam(required = false) Instant createdFrom,
                                    @RequestParam(required = false) Instant createdTo,
                                    @RequestParam(required = false) Boolean active,
                                    @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "15") int size) {
        return listQuery.search(new ProductListQuery.Filter(q, categoryIds, taxRateIds, taxReduction, stock, branchId,
                createdFrom, createdTo, active, Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
    }

    /** Danh mục + bảng giá đang áp dụng tại điểm tiêm (withPriceBooks=true). */
    public record SaleCatalogResponse(List<SaleCatalogQuery.SaleProduct> products, List<SalePriceBookQuery.SalePriceBook> priceBooks) {
    }

    /**
     * Danh mục màn bán hàng (lưu cục bộ để bán khi mất mạng). Thu ngân có catalog.view.
     * Mặc định trả mảng hàng hóa như cũ; withPriceBooks=true trả {products, priceBooks} để bán theo bảng giá khi offline.
     */
    @GetMapping("/sale-catalog")
    public Object saleCatalog(@RequestParam UUID branchId, @RequestParam(defaultValue = "false") boolean withPriceBooks) {
        List<SaleCatalogQuery.SaleProduct> products = saleCatalog.load(branchId);
        return withPriceBooks ? new SaleCatalogResponse(products, salePriceBooks.load(branchId)) : products;
    }

    @GetMapping("/{id}")
    public ProductDetail get(@PathVariable UUID id) {
        return detailQuery.get(id);
    }

    @GetMapping("/{id}/ledger")
    public PageResponse<LedgerLine> ledger(@PathVariable UUID id, @RequestParam(required = false) UUID branchId,
                                           @RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "20") int size) {
        return detailQuery.ledger(id, branchId, page, size);
    }

    @GetMapping("/{id}/lots")
    public List<LotResponse> lots(@PathVariable UUID id) {
        return detailQuery.lots(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('catalog.manage')")
    public ProductDetail create(@Valid @RequestBody ProductRequest req, @AuthenticationPrincipal Jwt jwt) {
        List<String> branches = jwt.getClaimAsStringList("branches");
        UUID id = commands.create(req, UUID.fromString(jwt.getSubject()), branches == null ? List.of() : branches);
        ProductDetail p = detailQuery.get(id);
        log(jwt, "Tạo", p, "Tạo hàng hóa " + p.name());
        return p;
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public ProductDetail update(@PathVariable UUID id, @Valid @RequestBody ProductRequest req, @AuthenticationPrincipal Jwt jwt) {
        commands.update(id, req);
        ProductDetail p = detailQuery.get(id);
        log(jwt, "Sửa", p, "Cập nhật hàng hóa " + p.name());
        return p;
    }

    /** Ngừng kinh doanh / cho phép kinh doanh. Body: {"active": false} */
    @PatchMapping("/{id}/active")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public ProductDetail setActive(@PathVariable UUID id, @RequestBody Map<String, Boolean> body, @AuthenticationPrincipal Jwt jwt) {
        boolean active = Boolean.TRUE.equals(body.get("active"));
        commands.setActive(id, active);
        ProductDetail p = detailQuery.get(id);
        log(jwt, active ? "Kinh doanh" : "Ngừng kinh doanh", p, (active ? "Cho phép kinh doanh " : "Ngừng kinh doanh ") + p.name());
        return p;
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('catalog.manage')")
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        ProductDetail p = detailQuery.get(id);
        commands.delete(id);
        log(jwt, "Xóa", p, "Xóa hàng hóa " + p.name());
    }
}
