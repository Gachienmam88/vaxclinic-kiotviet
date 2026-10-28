package com.vaxclinic.product.stock;

import com.vaxclinic.common.error.BusinessException;
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

    public StockMovementService(StockBalanceRepository balances, ProductLotRepository lots,
                                StockLedgerRepository ledger) {
        this.balances = balances;
        this.lots = lots;
        this.ledger = ledger;
    }

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
        if (after.signum() < 0) {
            throw BusinessException.badRequest("INSUFFICIENT_STOCK", "Không đủ tồn kho cho " + product.getName());
        }

        if (product.isLotManaged()) {
            applyLot(product, m);
        }

        // Moving-average cost: only incoming movements carrying a price change the cost.
        if (m.quantity().signum() > 0 && m.unitPrice() != null && m.docType() != DocType.SALE_RETURN) {
            BigDecimal totalBefore = product.getCost().multiply(before.max(BigDecimal.ZERO));
            BigDecimal totalIn = m.unitPrice().multiply(m.quantity());
            product.setCost(totalBefore.add(totalIn).divide(after, 4, RoundingMode.HALF_UP));
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
