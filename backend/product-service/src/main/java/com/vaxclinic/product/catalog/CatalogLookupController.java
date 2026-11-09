package com.vaxclinic.product.catalog;

import com.vaxclinic.product.catalog.CatalogDtos.CategoryRequest;
import com.vaxclinic.product.catalog.CatalogDtos.CategoryResponse;
import com.vaxclinic.product.catalog.CatalogDtos.PositionRequest;
import com.vaxclinic.product.catalog.CatalogDtos.PositionResponse;
import com.vaxclinic.product.catalog.CatalogDtos.TaxRateResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Nhóm hàng, tỷ lệ thuế, vị trí — dữ liệu chọn trong form hàng hóa. */
@RestController
public class CatalogLookupController {

    private final CatalogService catalog;

    public CatalogLookupController(CatalogService catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/api/categories")
    public List<CategoryResponse> listCategories() {
        return catalog.listCategories();
    }

    @PostMapping("/api/categories")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('catalog.manage')")
    public CategoryResponse createCategory(@Valid @RequestBody CategoryRequest req) {
        return catalog.createCategory(req);
    }

    @PutMapping("/api/categories/{id}")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public CategoryResponse updateCategory(@PathVariable UUID id, @Valid @RequestBody CategoryRequest req) {
        return catalog.updateCategory(id, req);
    }

    @DeleteMapping("/api/categories/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('catalog.manage')")
    public void deleteCategory(@PathVariable UUID id) {
        catalog.deleteCategory(id);
    }

    @GetMapping("/api/tax-rates")
    public List<TaxRateResponse> listTaxRates() {
        return catalog.listTaxRates();
    }

    @GetMapping("/api/positions")
    public List<PositionResponse> listPositions() {
        return catalog.listPositions();
    }

    @PostMapping("/api/positions")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('catalog.manage')")
    public PositionResponse createPosition(@Valid @RequestBody PositionRequest req) {
        return catalog.createPosition(req);
    }
}
