package com.vaxclinic.product.product;

import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.product.catalog.CategoryRepository;
import com.vaxclinic.product.catalog.PositionRepository;
import com.vaxclinic.product.catalog.TaxRateRepository;
import com.vaxclinic.product.product.ProductDtos.BranchStock;
import com.vaxclinic.product.product.ProductDtos.LedgerLine;
import com.vaxclinic.product.product.ProductDtos.LotResponse;
import com.vaxclinic.product.product.ProductDtos.ProductDetail;
import com.vaxclinic.product.product.ProductDtos.UnitResponse;
import com.vaxclinic.product.stock.ProductLotRepository;
import com.vaxclinic.product.stock.StockBalanceRepository;
import com.vaxclinic.product.stock.StockLedgerRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Dữ liệu các tab chi tiết hàng hóa: Thông tin (+ khối Nhà cung cấp), Thẻ kho, Tồn kho (+ dự kiến hết hàng), Lô/HSD. */
@Service
@Transactional(readOnly = true)
public class ProductDetailQuery {

    private final ProductCommandService commands;
    private final CategoryRepository categories;
    private final TaxRateRepository taxRates;
    private final PositionRepository positions;
    private final StockBalanceRepository balances;
    private final StockLedgerRepository ledger;
    private final ProductLotRepository lots;
    private final ProductDetailInsightRepository insights;

    public ProductDetailQuery(ProductCommandService commands, CategoryRepository categories,
                              TaxRateRepository taxRates, PositionRepository positions,
                              StockBalanceRepository balances, StockLedgerRepository ledger,
                              ProductLotRepository lots, ProductDetailInsightRepository insights) {
        this.commands = commands;
        this.categories = categories;
        this.taxRates = taxRates;
        this.positions = positions;
        this.balances = balances;
        this.ledger = ledger;
        this.lots = lots;
        this.insights = insights;
    }

    public ProductDetail get(UUID id) {
        Product p = commands.find(id);
        String categoryName = categories.findById(p.getCategoryId()).map(c -> c.getName()).orElse(null);
        String taxName = p.getTaxRateId() == null ? null
                : taxRates.findById(p.getTaxRateId()).map(t -> t.getName()).orElse(null);
        String positionName = p.getPositionId() == null ? null
                : positions.findById(p.getPositionId()).map(x -> x.getName()).orElse(null);
        var outDays = insights.expectedOutDaysByBranch(id);
        List<BranchStock> stocks = balances.findByIdProductId(id).stream()
                .map(b -> new BranchStock(b.getId().getBranchId(), b.getQuantity(), b.getReserved(),
                        outDays.get(b.getId().getBranchId())))
                .toList();
        return new ProductDetail(p.getId(), p.getName(), p.getShortName(), p.getEinvoiceName(),
                p.getCategoryId(), categoryName, p.getTaxRateId(), taxName, p.isTaxReduction(), p.isLotManaged(),
                p.getCost(), p.getMinStock(), p.getMaxStock(), p.getPositionId(), positionName, p.getWeight(),
                p.getWeightUnit(), p.getDescription(), p.getNote(), p.isLoyaltyPoints(), p.isActive(),
                p.getCreatedAt(), p.getUnits().stream().map(UnitResponse::of).toList(), stocks,
                insights.suppliers(id));
    }

    public PageResponse<LedgerLine> ledger(UUID productId, UUID branchId, int page, int size) {
        var pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        var result = branchId == null
                ? ledger.findByProductIdOrderByOccurredAtDescSeqDesc(productId, pageable)
                : ledger.findByProductIdAndBranchIdOrderByOccurredAtDescSeqDesc(productId, branchId, pageable);
        return PageResponse.from(result, e -> new LedgerLine(e.getId(), e.getDocType().name(), e.getDocCode(),
                e.getOccurredAt(), e.getBranchId(), e.getLotNumber(), e.getUnitPrice(), e.getCost(),
                e.getQuantity(), e.getBalanceAfter(), e.getPartnerName()));
    }

    /** Các lô còn tồn, hết hạn trước xếp trước (FEFO). */
    public List<LotResponse> lots(UUID productId) {
        return lots.findByProductIdAndQuantityGreaterThanOrderByExpiryDateAscLotNumberAsc(productId, BigDecimal.ZERO)
                .stream()
                .map(l -> new LotResponse(l.getId(), l.getBranchId(), l.getLotNumber(), l.getExpiryDate(), l.getQuantity()))
                .toList();
    }
}
