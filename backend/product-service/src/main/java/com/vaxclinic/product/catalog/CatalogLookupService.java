package com.vaxclinic.product.catalog;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.product.ProductRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Nhóm hàng (nhóm cha phải tồn tại, không là chính nó; không xóa khi còn nhóm con / hàng hóa), tỷ lệ thuế,
 * vị trí (tên không trùng).
 */
@Service
public class CatalogLookupService {

    public record CategoryRequest(@NotBlank @Size(max = 150) String name, UUID parentId) {
    }

    /** productCount: số hàng hóa (chưa xóa) trực tiếp trong nhóm. */
    public record CategoryResponse(UUID id, String name, UUID parentId, long productCount) {
    }

    public record TaxRateResponse(UUID id, String code, String name, BigDecimal vatRate) {
    }

    public record PositionRequest(@NotBlank @Size(max = 100) String name) {
    }

    public record PositionResponse(UUID id, String name) {
    }

    private final CategoryRepository categories;
    private final TaxRateRepository taxRates;
    private final PositionRepository positions;
    private final ProductRepository products;

    public CatalogLookupService(CategoryRepository categories, TaxRateRepository taxRates, PositionRepository positions,
                                ProductRepository products) {
        this.categories = categories;
        this.taxRates = taxRates;
        this.positions = positions;
        this.products = products;
    }

    public List<CategoryResponse> listCategories() {
        Map<UUID, Long> counts = productCounts();
        return categories.findAllByOrderByNameAsc().stream()
                .map(c -> new CategoryResponse(c.getId(), c.getName(), c.getParentId(), counts.getOrDefault(c.getId(), 0L)))
                .toList();
    }

    @Transactional
    public CategoryResponse createCategory(CategoryRequest req) {
        var c = new Category();
        c.setId(UUID.randomUUID());
        applyCategory(c, req);
        categories.save(c);
        return new CategoryResponse(c.getId(), c.getName(), c.getParentId(), 0);
    }

    /** Sửa trên entity đang quản lý — JPA tự ghi khi commit. */
    @Transactional
    public CategoryResponse updateCategory(UUID id, CategoryRequest req) {
        var c = categories.findById(id)
                .orElseThrow(() -> BusinessException.notFound("CATEGORY_NOT_FOUND", "Không tìm thấy nhóm hàng"));
        if (id.equals(req.parentId())) {
            throw BusinessException.badRequest("CATEGORY_SELF_PARENT", "Nhóm cha không được là chính nó");
        }
        applyCategory(c, req);
        return new CategoryResponse(c.getId(), c.getName(), c.getParentId(), productCounts().getOrDefault(id, 0L));
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

    private Map<UUID, Long> productCounts() {
        Map<UUID, Long> counts = new HashMap<>();
        for (Object[] row : products.countByCategory()) {
            counts.put((UUID) row[0], ((Number) row[1]).longValue());
        }
        return counts;
    }

    private void applyCategory(Category c, CategoryRequest req) {
        if (req.parentId() != null && !categories.existsById(req.parentId())) {
            throw BusinessException.badRequest("PARENT_NOT_FOUND", "Nhóm cha không tồn tại");
        }
        c.setName(req.name().trim());
        c.setParentId(req.parentId());
    }
}
