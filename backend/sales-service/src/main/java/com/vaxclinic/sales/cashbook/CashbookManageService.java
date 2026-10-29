package com.vaxclinic.sales.cashbook;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Sổ quỹ cho màn hình: danh sách / chi tiết phiếu, tạo / hủy phiếu (nghiệp vụ ở {@link CashbookService}) kèm ghi lịch sử
 * thao tác sau khi transaction của phiếu đã commit, và nhận phiếu tự động từ service khác.
 */
@Service
public class CashbookManageService {

    private final CashbookQuery query;
    private final CashbookService service;
    private final CashVoucherRepository vouchers;
    private final AuditLogger audit;

    public CashbookManageService(CashbookQuery query, CashbookService service, CashVoucherRepository vouchers, AuditLogger audit) {
        this.query = query;
        this.service = service;
        this.vouchers = vouchers;
        this.audit = audit;
    }

    public CashbookQuery.Page list(CashbookQuery.Filter filter) {
        return query.search(filter);
    }

    public List<String> categories() {
        return query.categories();
    }

    /** Phiếu + các hóa đơn được phân bổ. */
    @Transactional(readOnly = true)
    public Map<String, Object> get(UUID id) {
        CashVoucher v = vouchers.findById(id)
                .orElseThrow(() -> BusinessException.notFound("VOUCHER_NOT_FOUND", "Không tìm thấy phiếu"));
        return Map.of("voucher", v, "allocations", query.allocations(id));
    }

    public CashVoucher create(CashbookService.ManualRequest req, Actor actor) {
        CashVoucher v = service.createManual(req, actor);
        actor.audit(audit, v.getBranchId(), voucherFeature(v), "Tạo", v.getCode(), "Tạo phiếu " + v.getCode() + ": "
                + v.getCategory() + ", " + Actor.money(v.getAmount()) + (v.getPartnerName() == null ? "" : ", đối tượng " + v.getPartnerName()));
        return v;
    }

    /** Hủy phiếu; ghi lịch sử cả khi phiếu đã hủy từ trước (giữ hành vi cũ). */
    public void cancel(UUID id, Actor actor) {
        service.cancel(id);
        vouchers.findById(id).ifPresent(v -> actor.audit(audit, v.getBranchId(), voucherFeature(v), "Hủy", v.getCode(),
                "Hủy phiếu " + v.getCode() + ": " + v.getCategory() + ", " + Actor.money(v.getAmount())));
    }

    public void inbound(CashbookService.InboundCashflow in) {
        service.inbound(in);
    }

    private static String voucherFeature(CashVoucher v) {
        return "RECEIPT".equals(v.getVoucherType()) ? "Phiếu thu" : "Phiếu chi";
    }
}
