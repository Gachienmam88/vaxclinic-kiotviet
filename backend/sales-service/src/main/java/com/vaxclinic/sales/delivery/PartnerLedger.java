package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.error.BusinessException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Sổ công nợ đối tác giao hàng — nơi DUY NHẤT thay đổi delivery_partners.debt.
 * amount > 0: đối tác nợ cửa hàng (tiền thu hộ đã thu của khách, cửa hàng chi trả đối tác);
 * amount < 0: cửa hàng nợ đối tác (phí giao hàng) hoặc đối tác đã trả cửa hàng.
 * Khóa dòng đối tác trước khi ghi để "dư nợ sau" đúng thứ tự.
 */
@Component
public class PartnerLedger {

    public enum DocType { COD, FEE, SETTLEMENT, SETTLEMENT_CANCEL }

    private final PartnerLedgerRepository entries;

    public PartnerLedger(PartnerLedgerRepository entries) {
        this.entries = entries;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void post(UUID partnerId, UUID branchId, DocType type, UUID docId, String docCode, BigDecimal amount, String note,
                     Instant at) {
        if (amount.signum() == 0) {
            return;
        }
        BigDecimal debt = entries.lockDebt(partnerId);
        if (debt == null) {
            throw BusinessException.notFound("PARTNER_NOT_FOUND", "Không tìm thấy đối tác giao hàng");
        }
        BigDecimal after = debt.add(amount);
        entries.updateDebt(partnerId, after);
        entries.insert(partnerId, branchId, type.name(), docId, docCode, amount, after, note, at);
    }
}
