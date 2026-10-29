package com.vaxclinic.product.catalog;

import com.vaxclinic.product.catalog.CatalogLookupService.CategoryRequest;
import com.vaxclinic.product.catalog.CatalogLookupService.CategoryResponse;
import com.vaxclinic.product.catalog.CatalogLookupService.PositionRequest;
import com.vaxclinic.product.catalog.CatalogLookupService.PositionResponse;
import com.vaxclinic.product.catalog.CatalogLookupService.TaxRateResponse;
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

/** Nhóm hàng, tỷ lệ thuế, vị trí — dữ liệu chọn trong form hàng hóa. Nghiệp vụ ở {@link CatalogLookupService}. */
@RestController
public class CatalogLookupController {

    private final CatalogLookupService service;

    public CatalogLookupController(CatalogLookupService service) {
        this.service = service;
    }

    @GetMapping("/api/categories")
    public List<CategoryResponse> listCategories() {
        return service.listCategories();
    }

    @PostMapping("/api/categories")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('catalog.manage')")
    public CategoryResponse createCategory(@Valid @RequestBody CategoryRequest req) {
        return service.createCategory(req);
    }

    @PutMapping("/api/categories/{id}")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public CategoryResponse updateCategory(@PathVariable UUID id, @Valid @RequestBody CategoryRequest req) {
        return service.updateCategory(id, req);
    }

    @DeleteMapping("/api/categories/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('catalog.manage')")
    public void deleteCategory(@PathVariable UUID id) {
        service.deleteCategory(id);
    }

    @GetMapping("/api/tax-rates")
    public List<TaxRateResponse> listTaxRates() {
        return service.listTaxRates();
    }

    @GetMapping("/api/positions")
    public List<PositionResponse> listPositions() {
        return service.listPositions();
    }

    @PostMapping("/api/positions")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('catalog.manage')")
    public PositionResponse createPosition(@Valid @RequestBody PositionRequest req) {
        return service.createPosition(req);
    }
}
