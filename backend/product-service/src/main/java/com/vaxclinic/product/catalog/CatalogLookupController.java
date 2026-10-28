package com.vaxclinic.product.catalog;

import com.vaxclinic.common.error.BusinessException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Nhóm hàng, tỷ lệ thuế, vị trí — dữ liệu chọn trong form hàng hóa. */
@RestController
public class CatalogLookupController {

    private final CategoryRepository categories;
    private final TaxRateRepository taxRates;
    private final PositionRepository positions;
    private final com.vaxclinic.product.product.ProductRepository products;

    public CatalogLookupController(CategoryRepository categories, TaxRateRepository taxRates,
                                   PositionRepository positions,
                                   com.vaxclinic.product.product.ProductRepository products) {
        this.categories = categories;
        this.taxRates = taxRates;
        this.positions = positions;
        this.products = products;
    }

    public record CategoryRequest(@NotBlank @Size(max = 150) String name, UUID parentId) {
    }

    public record CategoryResponse(UUID id, String name, UUID parentId) {
    }

    public record TaxRateResponse(UUID id, String code, String name, BigDecimal vatRate) {
    }

    public record PositionRequest(@NotBlank @Size(max = 100) String name) {
    }

    public record PositionResponse(UUID id, String name) {
    }

    @GetMapping("/api/categories")
    public List<CategoryResponse> listCategories() {
        return categories.findAllByOrderByNameAsc().stream()
                .map(c -> new CategoryResponse(c.getId(), c.getName(), c.getParentId())).toList();
    }

    @PostMapping("/api/categories")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('catalog.manage')")
    @Transactional
    public CategoryResponse createCategory(@Valid @RequestBody CategoryRequest req) {
        var c = new Category();
        c.setId(UUID.randomUUID());
        applyCategory(c, req);
        categories.save(c);
        return new CategoryResponse(c.getId(), c.getName(), c.getParentId());
    }

    @PutMapping("/api/categories/{id}")
    @PreAuthorize("hasAuthority('catalog.manage')")
    @Transactional
    public CategoryResponse updateCategory(@PathVariable UUID id, @Valid @RequestBody CategoryRequest req) {
        var c = categories.findById(id)
                .orElseThrow(() -> BusinessException.notFound("CATEGORY_NOT_FOUND", "Không tìm thấy nhóm hàng"));
        if (id.equals(req.parentId())) {
            throw BusinessException.badRequest("CATEGORY_SELF_PARENT", "Nhóm cha không được là chính nó");
        }
        applyCategory(c, req);
        return new CategoryResponse(c.getId(), c.getName(), c.getParentId());
    }

    @DeleteMapping("/api/categories/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('catalog.manage')")
    @Transactional
    public void deleteCategory(@PathVariable UUID id) {
        if (categories.existsByParentId(id) || products.existsByCategoryIdAndDeletedFalse(id)) {
            throw BusinessException.conflict("CATEGORY_IN_USE", "Nhóm hàng đang có nhóm con hoặc hàng hóa");
        }
        categories.deleteById(id);
    }

    @GetMapping("/api/tax-rates")
    public List<TaxRateResponse> listTaxRates() {
        return taxRates.findAllByOrderBySortOrderAsc().stream()
                .map(t -> new TaxRateResponse(t.getId(), t.getCode(), t.getName(), t.getVatRate())).toList();
    }

    @GetMapping("/api/positions")
    public List<PositionResponse> listPositions() {
        return positions.findAllByOrderByNameAsc().stream()
                .map(p -> new PositionResponse(p.getId(), p.getName())).toList();
    }

    @PostMapping("/api/positions")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('catalog.manage')")
    @Transactional
    public PositionResponse createPosition(@Valid @RequestBody PositionRequest req) {
        if (positions.existsByNameIgnoreCase(req.name().trim())) {
            throw BusinessException.conflict("POSITION_EXISTS", "Vị trí đã tồn tại");
        }
        var p = new Position();
        p.setId(UUID.randomUUID());
        p.setName(req.name().trim());
        positions.save(p);
        return new PositionResponse(p.getId(), p.getName());
    }

    private void applyCategory(Category c, CategoryRequest req) {
        if (req.parentId() != null && !categories.existsById(req.parentId())) {
            throw BusinessException.badRequest("PARENT_NOT_FOUND", "Nhóm cha không tồn tại");
        }
        c.setName(req.name().trim());
        c.setParentId(req.parentId());
    }
}
