package com.vaxclinic.product.product;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.catalog.CategoryRepository;
import com.vaxclinic.product.catalog.PositionRepository;
import com.vaxclinic.product.catalog.TaxRateRepository;
import com.vaxclinic.product.product.ProductDtos.OpeningStock;
import com.vaxclinic.product.product.ProductDtos.ProductRequest;
import com.vaxclinic.product.stock.StockLedgerEntry.DocType;
import com.vaxclinic.product.stock.StockLedgerRepository;
import com.vaxclinic.product.stock.StockMovementService;
import com.vaxclinic.product.stock.StockMovementService.Movement;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.UUID;

/** Tạo / sửa / xóa hàng hóa. Tồn đầu kỳ được ghi cùng transaction với việc tạo hàng. */
@Service
public class ProductCommandService {

    private final ProductRepository products;
    private final CategoryRepository categories;
    private final TaxRateRepository taxRates;
    private final PositionRepository positions;
    private final StockLedgerRepository ledger;
    private final StockMovementService stock;
    private final ProductUnitSync unitSync;

    public ProductCommandService(ProductRepository products, CategoryRepository categories, TaxRateRepository taxRates,
                                 PositionRepository positions, StockLedgerRepository ledger,
                                 StockMovementService stock, ProductUnitSync unitSync) {
        this.products = products;
        this.categories = categories;
        this.taxRates = taxRates;
        this.positions = positions;
        this.ledger = ledger;
        this.stock = stock;
        this.unitSync = unitSync;
    }

    @Transactional
    public UUID create(ProductRequest req, UUID userId, Collection<String> allowedBranches) {
        var p = new Product();
        p.setId(UUID.randomUUID());
        apply(p, req);
        p.setLotManaged(req.lotManaged());
        unitSync.sync(p, req.units());
        products.saveAndFlush(p);
        if (req.openingStock() != null) {
            applyOpeningStock(p, req, req.openingStock(), userId, allowedBranches);
        }
        return p.getId();
    }

    @Transactional
    public void update(UUID id, ProductRequest req) {
        var p = find(id);
        if (p.isLotManaged() != req.lotManaged() && ledger.existsByProductId(id)) {
            throw BusinessException.badRequest("LOT_MODE_LOCKED",
                    "Hàng đã phát sinh giao dịch kho, không đổi được chế độ quản lý theo lô");
        }
        apply(p, req);
        p.setLotManaged(req.lotManaged());
        p.setUpdatedAt(Instant.now());
        unitSync.sync(p, req.units());
    }

    @Transactional
    public void setActive(UUID id, boolean active) {
        var p = find(id);
        p.setActive(active);
        p.setUpdatedAt(Instant.now());
    }

    /** Xóa mềm: giữ lại dữ liệu cho thẻ kho / hóa đơn cũ. */
    @Transactional
    public void delete(UUID id) {
        var p = find(id);
        p.setDeleted(true);
        p.setActive(false);
        p.setUpdatedAt(Instant.now());
    }

    Product find(UUID id) {
        return products.findById(id).filter(p -> !p.isDeleted())
                .orElseThrow(() -> BusinessException.notFound("PRODUCT_NOT_FOUND", "Không tìm thấy hàng hóa"));
    }

    private void apply(Product p, ProductRequest req) {
        if (!categories.existsById(req.categoryId())) {
            throw BusinessException.badRequest("CATEGORY_NOT_FOUND", "Nhóm hàng không tồn tại");
        }
        if (req.taxRateId() != null && !taxRates.existsById(req.taxRateId())) {
            throw BusinessException.badRequest("TAX_RATE_NOT_FOUND", "Tỷ lệ thuế không tồn tại");
        }
        if (req.positionId() != null && !positions.existsById(req.positionId())) {
            throw BusinessException.badRequest("POSITION_NOT_FOUND", "Vị trí không tồn tại");
        }
        if (req.minStock().compareTo(req.maxStock()) > 0) {
            throw BusinessException.badRequest("STOCK_LIMIT_INVALID", "Định mức tồn thấp nhất phải ≤ cao nhất");
        }
        p.setName(req.name().trim());
        p.setShortName(blankToNull(req.shortName()));
        p.setEinvoiceName(blankToNull(req.einvoiceName()));
        p.setCategoryId(req.categoryId());
        p.setTaxRateId(req.taxRateId());
        p.setTaxReduction(req.taxReduction());
        p.setMinStock(req.minStock());
        p.setMaxStock(req.maxStock());
        p.setPositionId(req.positionId());
        p.setWeight(req.weight());
        p.setWeightUnit("kg".equals(req.weightUnit()) ? "kg" : "g");
        p.setDescription(req.description());
        p.setNote(req.note());
        p.setLoyaltyPoints(req.loyaltyPoints());
        // Giá vốn chỉ nhập tay khi tạo / khi chưa có giao dịch kho; sau đó do nhập hàng tính bình quân.
        if (!ledger.existsByProductId(p.getId())) {
            p.setCost(req.cost());
        }
    }

    private void applyOpeningStock(Product p, ProductRequest req, OpeningStock opening, UUID userId,
                                   Collection<String> allowedBranches) {
        if (!allowedBranches.contains(opening.branchId().toString())) {
            throw BusinessException.badRequest("BRANCH_NOT_ALLOWED", "Bạn không làm việc tại điểm tiêm này");
        }
        if (p.isLotManaged()) {
            if (opening.lots() == null) {
                return;
            }
            for (var lot : opening.lots()) {
                stock.apply(p, new Movement(opening.branchId(), lot.quantity(), lot.lotNumber(), lot.expiryDate(),
                        DocType.OPENING, p.getId(), p.baseUnit().getCode(), req.cost(), null, userId));
            }
        } else if (opening.quantity() != null) {
            stock.apply(p, new Movement(opening.branchId(), opening.quantity(), null, null,
                    DocType.OPENING, p.getId(), p.baseUnit().getCode(), req.cost(), null, userId));
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
