package com.vaxclinic.product.catalog;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.catalog.CatalogDtos.CategoryRequest;
import com.vaxclinic.product.catalog.CatalogDtos.CategoryResponse;
import com.vaxclinic.product.catalog.CatalogDtos.PositionRequest;
import com.vaxclinic.product.catalog.CatalogDtos.PositionResponse;
import com.vaxclinic.product.catalog.CatalogDtos.TaxRateResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/** Nhóm hàng, tỷ lệ thuế, vị trí — dữ liệu chọn trong form hàng hóa. */
@Service
public class CatalogService {

    private final CategoryRepository categories;
    private final TaxRateRepository taxRates;
    private final PositionRepository positions;
    private final com.vaxclinic.product.product.ProductRepository products;

    public CatalogService(CategoryRepository categories, TaxRateRepository taxRates,
                          PositionRepository positions,
                          com.vaxclinic.product.product.ProductRepository products) {
        this.categories = categories;
        this.taxRates = taxRates;
        this.positions = positions;
        this.products = products;
    }

    public List<CategoryResponse> listCategories() {
        return categories.findAllByOrderByNameAsc().stream()
                .map(c -> new CategoryResponse(c.getId(), c.getName(), c.getParentId())).toList();
    }

    @Transactional
    public CategoryResponse createCategory(CategoryRequest req) {
        var c = new Category();
        c.setId(UUID.randomUUID());
        applyCategory(c, req);
        categories.save(c);
        return new CategoryResponse(c.getId(), c.getName(), c.getParentId());
    }

    @Transactional
    public CategoryResponse updateCategory(UUID id, CategoryRequest req) {
        var c = categories.findById(id)
                .orElseThrow(() -> BusinessException.notFound("CATEGORY_NOT_FOUND", "Không tìm thấy nhóm hàng"));
        if (id.equals(req.parentId())) {
            throw BusinessException.badRequest("CATEGORY_SELF_PARENT", "Nhóm cha không được là chính nó");
        }
        applyCategory(c, req);
        return new CategoryResponse(c.getId(), c.getName(), c.getParentId());
    }

    @Transactional
    public void deleteCategory(UUID id) {
        if (categories.existsByParentId(id) || products.existsByCategoryIdAndDeletedFalse(id)) {
            throw BusinessException.conflict("CATEGORY_IN_USE", "Nhóm hàng đang có nhóm con hoặc hàng hóa");
        }
        categories.deleteById(id);
    }

    public List<TaxRateResponse> listTaxRates() {
        return taxRates.findAllByOrderBySortOrderAsc().stream()
                .map(t -> new TaxRateResponse(t.getId(), t.getCode(), t.getName(), t.getVatRate())).toList();
    }

    public List<PositionResponse> listPositions() {
        return positions.findAllByOrderByNameAsc().stream()
                .map(p -> new PositionResponse(p.getId(), p.getName())).toList();
    }

    @Transactional
    public PositionResponse createPosition(PositionRequest req) {
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
