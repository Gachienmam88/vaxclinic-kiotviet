package com.vaxclinic.product.internal;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.product.Product;
import com.vaxclinic.product.product.ProductRepository;
import com.vaxclinic.product.stock.ProductLot;
import com.vaxclinic.product.stock.ProductLotRepository;
import com.vaxclinic.product.stock.StockLedgerEntry.DocType;
import com.vaxclinic.product.stock.StockMovementService;
import com.vaxclinic.product.stock.StockMovementService.Movement;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Trừ / hoàn kho cho chứng từ bán hàng của sales-service.
 * - SALE: hàng theo lô tự phân bổ FEFO trên các lô CÒN HẠN tại điểm tiêm; thiếu → lỗi (không bán vắc xin hết hạn).
 * - SALE_CANCEL: hoàn lại đúng các lô đã xuất của chứng từ SALE gốc.
 * Idempotent theo (docId, docType): gọi lại trả về kết quả lần đầu, không trừ kho lần 2.
 */
@Service
public class InternalStockService {

    public record LineInput(UUID lineId, UUID productId, UUID unitId, BigDecimal quantity) {
    }

    public record StockDocRequest(UUID docId, String docType, String docCode, UUID branchId, String partnerName,
                                  UUID userId, List<LineInput> lines) {
    }

    public record Allocation(String lotNumber, java.time.LocalDate expiryDate, BigDecimal baseQuantity) {
    }

    /** unitCost = giá vốn của 1 đơn vị đã bán (theo đơn vị trên dòng) tại thời điểm xuất. */
    public record LineResult(UUID lineId, UUID productId, BigDecimal unitCost, BigDecimal conversionRate,
                             List<Allocation> allocations) {
    }

    public record StockDocResult(UUID docId, String docType, List<LineResult> lines) {
    }

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final ProductRepository products;
    private final ProductLotRepository lots;
    private final StockMovementService stock;

    public InternalStockService(JdbcTemplate jdbc, ObjectMapper json, ProductRepository products,
                                ProductLotRepository lots, StockMovementService stock) {
        this.jdbc = jdbc;
        this.json = json;
        this.products = products;
        this.lots = lots;
        this.stock = stock;
    }

    @Transactional
    public StockDocResult apply(StockDocRequest req) {
        var existing = load(req.docId(), req.docType());
        if (existing != null) {
            return existing;
        }
        StockDocResult result = switch (req.docType()) {
            case "SALE" -> sale(req);
            case "SALE_CANCEL" -> cancelSale(req);
            default -> throw BusinessException.badRequest("DOC_TYPE_UNSUPPORTED", "Loại chứng từ kho không hỗ trợ");
        };
        try {
            jdbc.update("insert into external_stock_docs(doc_id, doc_type, doc_code, result) values (?,?,?,?)",
                    req.docId(), req.docType(), req.docCode(), json.writeValueAsString(result));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
        return result;
    }

    private StockDocResult sale(StockDocRequest req) {
        var results = new ArrayList<LineResult>();
        for (var line : req.lines()) {
            Product p = products.findById(line.productId()).filter(x -> !x.isDeleted())
                    .orElseThrow(() -> BusinessException.badRequest("PRODUCT_NOT_FOUND", "Hàng hóa không tồn tại"));
            var unit = p.getUnits().stream().filter(u -> u.getId().equals(line.unitId())).findFirst()
                    .orElseThrow(() -> BusinessException.badRequest("UNIT_NOT_FOUND", "Đơn vị tính không hợp lệ"));
            BigDecimal baseQty = line.quantity().multiply(unit.getConversionRate());
            BigDecimal unitCost = p.getCost().multiply(unit.getConversionRate()).setScale(4, RoundingMode.HALF_UP);
            var allocations = new ArrayList<Allocation>();
            if (p.isLotManaged()) {
                BigDecimal remaining = baseQty;
                for (ProductLot lot : usableLots(p.getId(), req.branchId())) {
                    if (remaining.signum() <= 0) {
                        break;
                    }
                    BigDecimal take = remaining.min(lot.getQuantity());
                    move(p, req, take.negate(), lot.getLotNumber(), DocType.SALE);
                    allocations.add(new Allocation(lot.getLotNumber(), lot.getExpiryDate(), take));
                    remaining = remaining.subtract(take);
                }
                if (remaining.signum() > 0) {
                    throw BusinessException.badRequest("INSUFFICIENT_STOCK",
                            p.getName() + ": không đủ tồn ở các lô còn hạn sử dụng (thiếu " + remaining.stripTrailingZeros().toPlainString() + ")");
                }
            } else {
                move(p, req, baseQty.negate(), null, DocType.SALE);
                allocations.add(new Allocation(null, null, baseQty));
            }
            results.add(new LineResult(line.lineId(), p.getId(), unitCost, unit.getConversionRate(), allocations));
        }
        return new StockDocResult(req.docId(), req.docType(), results);
    }

    private StockDocResult cancelSale(StockDocRequest req) {
        StockDocResult original = load(req.docId(), "SALE");
        if (original == null) {
            throw BusinessException.badRequest("SALE_DOC_NOT_FOUND", "Không tìm thấy chứng từ xuất kho của hóa đơn");
        }
        for (var line : original.lines()) {
            Product p = products.findById(line.productId()).orElseThrow();
            for (var a : line.allocations()) {
                move(p, req, a.baseQuantity(), a.lotNumber(), DocType.SALE_CANCEL);
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

    private void move(Product p, StockDocRequest req, BigDecimal qty, String lot, DocType type) {
        stock.apply(p, new Movement(req.branchId(), qty, lot, null, type, req.docId(), req.docCode(), null,
                req.partnerName(), req.userId()));
    }

    private StockDocResult load(UUID docId, String docType) {
        var rows = jdbc.queryForList("select result from external_stock_docs where doc_id = ? and doc_type = ?",
                String.class, docId, docType);
        if (rows.isEmpty()) {
            return null;
        }
        try {
            return json.readValue(rows.get(0), StockDocResult.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
