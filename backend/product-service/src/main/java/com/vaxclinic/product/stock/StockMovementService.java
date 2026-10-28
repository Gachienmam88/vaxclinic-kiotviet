package com.vaxclinic.product.stock;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.settings.ShopSettingsClient;
import com.vaxclinic.product.product.Product;
import com.vaxclinic.product.stock.StockLedgerEntry.DocType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.UUID;

/**
 * The only place that changes stock. Every movement, in one transaction:
 * lock balance (+ lot) → update quantities → (incoming with price) recompute moving-average cost → write ledger line.
 * Callers: product opening stock now; purchase receipts / sales / returns in later phases.
 */
@Service
public class StockMovementService {

    /** One stock change in base units. quantity > 0 = in, < 0 = out. */
    public record Movement(UUID branchId, BigDecimal quantity, String lotNumber, LocalDate expiryDate,
                           DocType docType, UUID docId, String docCode, BigDecimal unitPrice,
                           String partnerName, UUID userId) {
    }

    private final StockBalanceRepository balances;
    private final ProductLotRepository lots;
    private final StockLedgerRepository ledger;
    private final ShopSettingsClient settings;

    public StockMovementService(StockBalanceRepository balances, ProductLotRepository lots,
                                StockLedgerRepository ledger, ShopSettingsClient settings) {
        this.balances = balances;
        this.lots = lots;
        this.ledger = ledger;
        this.settings = settings;
    }

    /**
     * Thiết lập "Cho phép giao dịch khi hết tồn kho": chỉ hàng KHÔNG theo lô, chỉ chứng từ xuất kho thông thường
     * (bán, trả hàng nhập, ...). Hủy phiếu nhập không bao giờ được làm âm kho.
     */
    private boolean negativeAllowed(Product product, DocType type) {
        return !product.isLotManaged() && NEGATIVE_OK.contains(type) && settings.get().sales().allowNegativeStock();
    }

    private static final java.util.Set<DocType> NEGATIVE_OK = java.util.EnumSet.of(DocType.SALE,
            DocType.PURCHASE_RETURN, DocType.SALE_RETURN_CANCEL_OUT, DocType.TRANSFER_OUT, DocType.DAMAGE);

    @Transactional(propagation = Propagation.MANDATORY)
    public void apply(Product product, Movement m) {
        if (m.quantity().signum() == 0) {
            return;
        }
        var key = new StockBalance.Key(product.getId(), m.branchId());
        var balance = balances.findForUpdate(key)
                .orElseGet(() -> balances.saveAndFlush(new StockBalance(product.getId(), m.branchId())));
        BigDecimal before = balance.getQuantity();
        BigDecimal after = before.add(m.quantity());
        // Chỉ chặn chiều XUẤT: tồn đang âm (bán khi hết tồn) thì nhập lại (trả hàng, hủy HĐ) vẫn phải được, dù sau đó còn âm.
        if (m.quantity().signum() < 0 && after.signum() < 0 && !negativeAllowed(product, m.docType())) {
            throw BusinessException.badRequest("INSUFFICIENT_STOCK", "Không đủ tồn kho cho " + product.getName());
        }

        if (product.isLotManaged()) {
            applyLot(product, m);
        }

        // Moving-average cost: (old value + qty × price) / new qty, for supplier-side documents only.
        // Works both ways: +qty on receipt, -qty when a receipt is cancelled or goods are returned to the supplier.
        // Sales never change cost. If stock reaches 0 or the result would go negative, keep the last cost.
        if (m.docType().affectsCost() && m.unitPrice() != null && after.signum() > 0) {
            BigDecimal value = product.getCost().multiply(before.max(BigDecimal.ZERO))
                    .add(m.unitPrice().multiply(m.quantity()));
            if (value.signum() >= 0) {
                product.setCost(value.divide(after, 4, RoundingMode.HALF_UP));
            }
        }
        balance.setQuantity(after);

        var line = new StockLedgerEntry();
        line.setId(UUID.randomUUID());
        line.setProductId(product.getId());
        line.setBranchId(m.branchId());
        line.setLotNumber(m.lotNumber());
        line.setDocType(m.docType());
        line.setDocId(m.docId());
        line.setDocCode(m.docCode());
        line.setQuantity(m.quantity());
        line.setUnitPrice(m.unitPrice() == null ? product.getCost() : m.unitPrice());
        line.setCost(product.getCost());
        line.setBalanceAfter(after);
        line.setPartnerName(m.partnerName());
        line.setCreatedBy(m.userId());
        ledger.save(line);
    }

    private void applyLot(Product product, Movement m) {
        if (m.lotNumber() == null || m.lotNumber().isBlank()) {
            throw BusinessException.badRequest("LOT_REQUIRED", product.getName() + " quản lý theo lô: cần nhập số lô");
        }
        String lotNumber = m.lotNumber().trim();
        var lot = lots.findForUpdate(product.getId(), m.branchId(), lotNumber).orElseGet(() -> {
            if (m.expiryDate() == null) {
                throw BusinessException.badRequest("EXPIRY_REQUIRED", "Lô " + lotNumber + ": cần nhập hạn sử dụng");
            }
            var l = new ProductLot();
            l.setId(UUID.randomUUID());
            l.setProductId(product.getId());
            l.setBranchId(m.branchId());
            l.setLotNumber(lotNumber);
            l.setExpiryDate(m.expiryDate());
            return l;
        });
        if (m.expiryDate() != null && !m.expiryDate().equals(lot.getExpiryDate()) && lot.getQuantity().signum() > 0) {
            throw BusinessException.badRequest("LOT_EXPIRY_MISMATCH",
                    "Lô " + lotNumber + " đã có hạn sử dụng " + lot.getExpiryDate());
        }
        BigDecimal after = lot.getQuantity().add(m.quantity());
        if (after.signum() < 0) {
            throw BusinessException.badRequest("INSUFFICIENT_LOT_STOCK", "Lô " + lotNumber + " không đủ tồn");
        }
        lot.setQuantity(after);
        lots.save(lot);
    }
}
