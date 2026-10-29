package com.vaxclinic.product.internal;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.product.Product;
import com.vaxclinic.product.product.ProductRepository;
import com.vaxclinic.product.stock.ProductLot;
import com.vaxclinic.product.stock.ProductLotRepository;
import com.vaxclinic.product.stock.StockBalance;
import com.vaxclinic.product.stock.StockBalanceRepository;
import com.vaxclinic.product.stock.StockLedgerEntry.DocType;
import com.vaxclinic.product.stock.StockMovementService;
import com.vaxclinic.product.stock.StockMovementService.Movement;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Trừ / hoàn kho cho chứng từ bán hàng của sales-service. Mỗi lời gọi = 1 transaction, idempotent theo (docId, docType).
 * - SALE: hàng theo lô tự phân bổ FEFO trên lô CÒN HẠN; thiếu → lỗi (không bán vắc xin hết hạn).
 * - SALE_CANCEL: hoàn đúng các lô của chứng từ bán hiện hành (SALE hoặc SALE_REPLACE cùng docId).
 * - SALE_REPLACE (sửa hóa đơn): hoàn lô của previousDocId + xuất lại theo dòng mới, CÙNG 1 transaction
 *   → thiếu hàng ở bản mới thì kho giữ nguyên như trước khi sửa.
 * - SALE có lotNumber trên dòng (import hóa đơn từ file): xuất đúng lô đó (còn hạn, đủ tồn), không FEFO.
 * - SALE_MERGE (gộp hóa đơn): hoàn các chứng từ previousDocIds + xuất lại ĐÚNG các lô cũ cho dòng mới (sourceLineId =
 *   dòng gốc), cùng 1 transaction → tồn kho không đổi; chứng từ cũ được đánh dấu SALE_CANCEL để không hoàn lần 2.
 * - SALE_RETURN: nhập lại đúng các lô sales-service chỉ định (lotNumber + baseQuantity); lô chưa có + có expiryDate
 *   (trả nhanh) → tạo lô mới; SALE_RETURN_CANCEL: đảo lại.
 */
@Service
public class InternalStockService {

    /**
     * Bán: productId + unitId + quantity. Trả hàng: productId + lotNumber + baseQuantity;
     * expiryDate chỉ dùng cho trả nhanh nhập lô MỚI (lô chưa có tại chi nhánh) — lô đã có thì phải trùng hạn.
     */
    public record LineInput(UUID lineId, UUID productId, UUID unitId, BigDecimal quantity, String lotNumber,
                            BigDecimal baseQuantity, LocalDate expiryDate, UUID sourceLineId) {
    }

    /** previousDocIds: chỉ dùng cho SALE_MERGE — các chứng từ bán của hóa đơn được gộp. */
    public record StockDocRequest(UUID docId, String docType, String docCode, UUID branchId, String partnerName,
                                  UUID userId, UUID previousDocId, List<LineInput> lines, List<UUID> previousDocIds) {
    }

    public record Allocation(String lotNumber, LocalDate expiryDate, BigDecimal baseQuantity) {
    }

    /** unitCost = giá vốn của 1 đơn vị đã bán (theo đơn vị trên dòng) tại thời điểm xuất. */
    public record LineResult(UUID lineId, UUID productId, BigDecimal unitCost, BigDecimal conversionRate,
                             List<Allocation> allocations) {
    }

    public record StockDocResult(UUID docId, String docType, List<LineResult> lines) {
    }

    private final ExternalStockDocRepository docs;
    private final ProductRepository products;
    private final ProductLotRepository lots;
    private final StockBalanceRepository balances;
    private final StockMovementService stock;
    private final SaleReturnLotExpiryResolver returnLots;

    public InternalStockService(ExternalStockDocRepository docs, ProductRepository products,
                                ProductLotRepository lots, StockBalanceRepository balances, StockMovementService stock,
                                SaleReturnLotExpiryResolver returnLots) {
        this.docs = docs;
        this.products = products;
        this.lots = lots;
        this.balances = balances;
        this.stock = stock;
        this.returnLots = returnLots;
    }

    @Transactional
    public StockDocResult apply(StockDocRequest req) {
        var existing = load(req.docId(), List.of(req.docType()));
        if (existing != null) {
            return existing;
        }
        StockDocResult result = switch (req.docType()) {
            case "SALE" -> sale(req, DocType.SALE);
            case "SALE_CANCEL" -> reverse(req, List.of("SALE", "SALE_REPLACE"), req.docId(), DocType.SALE_CANCEL, true);
            case "SALE_REPLACE" -> {
                reverse(req, List.of("SALE", "SALE_REPLACE"), req.previousDocId(), DocType.SALE_CANCEL, true);
                yield sale(req, DocType.SALE);
            }
            case "SALE_MERGE" -> merge(req);
            case "SALE_RETURN" -> saleReturn(req);
            case "SALE_RETURN_CANCEL" -> reverse(req, List.of("SALE_RETURN"), req.docId(), DocType.SALE_RETURN, false);
            default -> throw BusinessException.badRequest("DOC_TYPE_UNSUPPORTED", "Loại chứng từ kho không hỗ trợ");
        };
        docs.insert(req.docId(), req.docType(), req.docCode(), result);
        return result;
    }

    private StockDocResult sale(StockDocRequest req, DocType type) {
        var results = new ArrayList<LineResult>();
        for (var line : req.lines()) {
            Product p = product(line.productId());
            var unit = p.getUnits().stream().filter(u -> u.getId().equals(line.unitId())).findFirst()
                    .orElseThrow(() -> BusinessException.badRequest("UNIT_NOT_FOUND", "Đơn vị tính không hợp lệ"));
            BigDecimal baseQty = line.quantity().multiply(unit.getConversionRate());
            BigDecimal unitCost = p.getCost().multiply(unit.getConversionRate()).setScale(4, RoundingMode.HALF_UP);
            var allocations = new ArrayList<Allocation>();
            if (p.isLotManaged() && line.lotNumber() != null && !line.lotNumber().isBlank()) {
                allocations.add(saleFromLot(p, req, line.lotNumber().trim(), baseQty, type));
            } else if (p.isLotManaged()) {
                // Lock the (product, branch) balance row BEFORE reading lots: concurrent sales of the same item
                // at the same branch then read lot quantities strictly one after another (no double allocation).
                balances.findForUpdate(new StockBalance.Key(p.getId(), req.branchId()));
                BigDecimal remaining = baseQty;
                for (ProductLot lot : usableLots(p.getId(), req.branchId())) {
                    if (remaining.signum() <= 0) {
                        break;
                    }
                    BigDecimal take = remaining.min(lot.getQuantity());
                    move(p, req, take.negate(), lot.getLotNumber(), type);
                    allocations.add(new Allocation(lot.getLotNumber(), lot.getExpiryDate(), take));
                    remaining = remaining.subtract(take);
                }
                if (remaining.signum() > 0) {
                    throw BusinessException.badRequest("INSUFFICIENT_STOCK",
                            p.getName() + ": không đủ tồn ở các lô còn hạn sử dụng (thiếu " + remaining.stripTrailingZeros().toPlainString() + ")");
                }
            } else {
                move(p, req, baseQty.negate(), null, type);
                allocations.add(new Allocation(null, null, baseQty));
            }
            results.add(new LineResult(line.lineId(), p.getId(), unitCost, unit.getConversionRate(), allocations));
        }
        return new StockDocResult(req.docId(), req.docType(), results);
    }

    /** Xuất đúng 1 lô chỉ định: lô phải có tại chi nhánh, còn hạn sử dụng và đủ tồn. */
    private Allocation saleFromLot(Product p, StockDocRequest req, String lotNumber, BigDecimal baseQty, DocType type) {
        balances.findForUpdate(new StockBalance.Key(p.getId(), req.branchId()));
        ProductLot lot = lots.findByProductIdAndBranchIdAndLotNumber(p.getId(), req.branchId(), lotNumber)
                .orElseThrow(() -> BusinessException.badRequest("LOT_NOT_FOUND", p.getName() + ": không có lô " + lotNumber + " tại chi nhánh"));
        if (lot.getExpiryDate().isBefore(LocalDate.now())) {
            throw BusinessException.badRequest("LOT_EXPIRED", p.getName() + ": lô " + lotNumber + " đã hết hạn sử dụng");
        }
        if (lot.getQuantity().compareTo(baseQty) < 0) {
            throw BusinessException.badRequest("INSUFFICIENT_LOT_STOCK", p.getName() + ": lô " + lotNumber + " không đủ tồn (còn "
                    + lot.getQuantity().stripTrailingZeros().toPlainString() + ")");
        }
        move(p, req, baseQty.negate(), lotNumber, type);
        return new Allocation(lotNumber, lot.getExpiryDate(), baseQty);
    }

    /**
     * Gộp hóa đơn: hoàn từng chứng từ cũ (ghi luôn SALE_CANCEL cho chứng từ đó → hủy lại sau này không hoàn lần 2),
     * rồi xuất lại đúng lô + giá vốn của dòng gốc cho dòng mới.
     */
    private StockDocResult merge(StockDocRequest req) {
        if (req.previousDocIds() == null || req.previousDocIds().size() < 2) {
            throw BusinessException.badRequest("MERGE_DOCS_REQUIRED", "Cần ít nhất 2 chứng từ bán để gộp");
        }
        var source = new java.util.HashMap<UUID, LineResult>();
        for (UUID prev : req.previousDocIds()) {
            if (load(prev, List.of("SALE_CANCEL")) != null) {
                throw BusinessException.badRequest("STOCK_DOC_CANCELLED", "Chứng từ kho của hóa đơn gộp đã được hoàn trước đó");
            }
            StockDocResult reversed = reverse(req, List.of("SALE", "SALE_REPLACE"), prev, DocType.SALE_CANCEL, true);
            docs.insert(prev, "SALE_CANCEL", req.docCode(), reversed);
            reversed.lines().forEach(l -> source.put(l.lineId(), l));
        }
        var results = new ArrayList<LineResult>();
        for (var line : req.lines()) {
            LineResult src = source.get(line.sourceLineId());
            if (src == null) {
                throw BusinessException.badRequest("MERGE_LINE_NOT_FOUND", "Dòng hàng gộp không thuộc chứng từ kho gốc");
            }
            Product p = product(src.productId());
            for (var a : src.allocations()) {
                move(p, req, a.baseQuantity().negate(), a.lotNumber(), DocType.SALE);
            }
            results.add(new LineResult(line.lineId(), src.productId(), src.unitCost(), src.conversionRate(), src.allocations()));
        }
        return new StockDocResult(req.docId(), req.docType(), results);
    }

    /** Khách trả hàng: nhập lại kho theo lô được chỉ định (lô đã bán cho khách). */
    private StockDocResult saleReturn(StockDocRequest req) {
        var results = new ArrayList<LineResult>();
        for (var line : req.lines()) {
            Product p = product(line.productId());
            if (p.isLotManaged() && (line.lotNumber() == null || line.lotNumber().isBlank())) {
                throw BusinessException.badRequest("LOT_REQUIRED", p.getName() + ": thiếu lô hàng trả");
            }
            LocalDate expiry = p.isLotManaged() ? returnLots.expiry(p, req.branchId(), line.lotNumber(), line.expiryDate()) : null;
            String lot = p.isLotManaged() ? line.lotNumber().trim() : null;
            stock.apply(p, new Movement(req.branchId(), line.baseQuantity(), lot, expiry, DocType.SALE_RETURN,
                    req.docId(), req.docCode(), null, req.partnerName(), req.userId()));
            results.add(new LineResult(line.lineId(), p.getId(), p.getCost(), BigDecimal.ONE,
                    List.of(new Allocation(lot, expiry, line.baseQuantity()))));
        }
        return new StockDocResult(req.docId(), req.docType(), results);
    }

    /**
     * Đảo chứng từ docId (loại trong originalTypes): outgoing = true → chứng từ gốc là xuất, đảo = nhập lại;
     * false → chứng từ gốc là nhập (trả hàng), đảo = xuất ra.
     */
    private StockDocResult reverse(StockDocRequest req, List<String> originalTypes, UUID docId, DocType type,
                                   boolean outgoing) {
        StockDocResult original = load(docId, originalTypes);
        if (original == null) {
            throw BusinessException.badRequest("STOCK_DOC_NOT_FOUND", "Không tìm thấy chứng từ kho gốc của " + req.docCode());
        }
        for (var line : original.lines()) {
            Product p = product(line.productId());
            for (var a : line.allocations()) {
                move(p, req, outgoing ? a.baseQuantity() : a.baseQuantity().negate(), a.lotNumber(),
                        outgoing ? DocType.SALE_CANCEL : DocType.SALE_RETURN_CANCEL_OUT);
            }
        }
        return new StockDocResult(req.docId(), req.docType(), original.lines());
    }

    /** Lô còn hàng tại điểm tiêm, chưa hết hạn, hết hạn trước xuất trước. */
    private List<ProductLot> usableLots(UUID productId, UUID branchId) {
        LocalDate today = LocalDate.now();
        return lots.findByProductIdAndQuantityGreaterThanOrderByExpiryDateAscLotNumberAsc(productId, BigDecimal.ZERO)
                .stream().filter(l -> l.getBranchId().equals(branchId) && !l.getExpiryDate().isBefore(today)).toList();
    }

    private Product product(UUID id) {
        return products.findById(id)
                .orElseThrow(() -> BusinessException.badRequest("PRODUCT_NOT_FOUND", "Hàng hóa không tồn tại"));
    }

    private void move(Product p, StockDocRequest req, BigDecimal qty, String lot, DocType type) {
        stock.apply(p, new Movement(req.branchId(), qty, lot, null, type, req.docId(), req.docCode(), null,
                req.partnerName(), req.userId()));
    }

    private StockDocResult load(UUID docId, List<String> docTypes) {
        if (docId == null) {
            return null;
        }
        return docs.find(docId, docTypes);
    }
}
