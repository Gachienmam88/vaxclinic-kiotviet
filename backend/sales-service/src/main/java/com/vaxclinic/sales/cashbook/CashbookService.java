package com.vaxclinic.sales.cashbook;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.debt.DebtLedger;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Phiếu thu/chi tạo tay, hủy phiếu, và nhận phiếu tự động từ service khác (phiếu chi trả NCC). */
@Service
public class CashbookService {

    public record ManualRequest(@NotNull @Pattern(regexp = "RECEIPT|PAYMENT") String voucherType,
                                @NotNull @Pattern(regexp = "CASH|BANK|EWALLET") String fund, UUID bankAccountId,
                                @NotBlank(message = "Chọn loại thu chi") String category,
                                @NotNull @DecimalMin(value = "1", message = "Số tiền phải lớn hơn 0") BigDecimal amount,
                                Instant occurredAt, @NotNull UUID branchId,
                                @Pattern(regexp = "CUSTOMER|SUPPLIER|EMPLOYEE|OTHER") String partnerType,
                                UUID partnerId, String partnerName, String partnerPhone, UUID collectorId,
                                String collectorName, boolean accounting, String note) {
    }

    /** Payload outbox từ product-service (xem CashflowOutbox). action: CREATE | UPDATE | CANCEL. */
    public record InboundCashflow(String action, String sourceType, UUID sourceId, String code, String voucherType,
                                  String fund, UUID bankAccountId, String category, BigDecimal amount, Instant occurredAt,
                                  UUID branchId, String partnerType, UUID partnerId, String partnerName, String partnerPhone,
                                  UUID userId, String userName, String note) {
    }

    private final CashVoucherRepository vouchers;
    private final CashbookWriter writer;
    private final DebtLedger debt;
    private final com.vaxclinic.sales.common.SalesRules rules;

    public CashbookService(CashVoucherRepository vouchers, CashbookWriter writer, DebtLedger debt,
                           com.vaxclinic.sales.common.SalesRules rules) {
        this.vouchers = vouchers;
        this.writer = writer;
        this.debt = debt;
        this.rules = rules;
    }

    @Transactional
    public CashVoucher createManual(ManualRequest r, Actor actor) {
        // Công nợ NCC chỉ có 1 nơi ghi là product-service: thanh toán / thu tiền NCC phải làm ở màn Nhà cung cấp
        // (phiếu chi tự sinh sang Sổ quỹ qua outbox) để sổ công nợ NCC và Sổ quỹ luôn khớp nhau.
        if ("SUPPLIER".equals(r.partnerType())) {
            throw BusinessException.badRequest("SUPPLIER_VOUCHER_VIA_SUPPLIER_SCREEN",
                    "Thanh toán cho nhà cung cấp hãy tạo tại Mua hàng → Nhà cung cấp → Nợ cần trả nhà cung cấp → Thanh toán"
                            + " để công nợ nhà cung cấp được cập nhật");
        }
        actor.checkBranch(r.branchId());
        rules.checkNotLocked(r.branchId(), r.occurredAt() == null ? Instant.now() : r.occurredAt());
        boolean receipt = "RECEIPT".equals(r.voucherType());
        String code = receipt ? "PT%06d".formatted(vouchers.nextReceiptNumber()) : "PC%06d".formatted(vouchers.nextPaymentNumber());
        var v = CashbookWriter.newVoucher(code, r.voucherType(), r.fund(), r.category().trim(), r.amount());
        v.setBankAccountId(r.bankAccountId());
        v.setOccurredAt(r.occurredAt() == null ? Instant.now() : r.occurredAt());
        v.setBranchId(r.branchId());
        v.setPartnerType(r.partnerType() == null ? "OTHER" : r.partnerType());
        v.setPartnerId(r.partnerId());
        v.setPartnerName(Actor.blankToNull(r.partnerName()));
        v.setPartnerPhone(Actor.blankToNull(r.partnerPhone()));
        v.setCollectorId(r.collectorId() == null ? actor.id() : r.collectorId());
        v.setCollectorName(r.collectorId() == null ? actor.name() : r.collectorName());
        v.setCreatedBy(actor.id());
        v.setCreatedByName(actor.name());
        v.setAccounting(r.accounting());
        v.setNote(r.note());
        return writer.save(v, List.of());
    }

    /** Hủy phiếu tạo tay / thu nợ. Phiếu tự động của hóa đơn, phiếu nhập phải hủy từ chứng từ gốc. */
    @Transactional
    public void cancel(UUID id) {
        CashVoucher v = vouchers.findById(id)
                .orElseThrow(() -> BusinessException.notFound("VOUCHER_NOT_FOUND", "Không tìm thấy phiếu"));
        if ("INVOICE".equals(v.getSourceType()) || "INVOICE_EXTRA".equals(v.getSourceType()) || "PURCHASE".equals(v.getSourceType()) || "RETURN".equals(v.getSourceType())
                || "ORDER".equals(v.getSourceType()) || "DELIVERY".equals(v.getSourceType())) {
            throw BusinessException.badRequest("VOUCHER_AUTO",
                    "Phiếu tự động — hãy hủy hóa đơn / phiếu nhập / phiếu trả hàng / đơn đặt hàng / phiếu đối soát giao hàng gốc");
        }
        if ("CANCELLED".equals(v.getStatus())) {
            return;
        }
        rules.checkNotLocked(v.getBranchId(), v.getOccurredAt());
        writer.cancel(v);
        if (v.isAffectsDebt() && v.getPartnerId() != null && "CUSTOMER".equals(v.getPartnerType())) {
            BigDecimal back = "RECEIPT".equals(v.getVoucherType()) ? v.getAmount() : v.getAmount().negate();
            debt.post(v.getPartnerId(), DebtLedger.DocType.PAYMENT_CANCEL, v.getId(), v.getCode(), back, "Hủy phiếu " + v.getCode(), Instant.now());
        }
    }

    /**
     * Nguồn outbox là chi phí kinh doanh → phiếu hạch toán (vào "Chi phí lương" Báo cáo tài chính): chi trả lương (PAYROLL) và
     * tạm ứng lương (HR_ADVANCE) từ identity-service. Phiếu từ product-service (PURCHASE: trả NCC, NCC hoàn tiền) không hạch toán.
     */
    private static final java.util.Set<String> ACCOUNTED_SOURCES = java.util.Set.of("PAYROLL", "HR_ADVANCE");

    /** Idempotent: CREATE lặp lại (unique source) bị bỏ qua; CANCEL khi đã hủy cũng bỏ qua. */
    @Transactional
    public void inbound(InboundCashflow in) {
        var existing = vouchers.findBySourceTypeAndSourceId(in.sourceType(), in.sourceId());
        if ("CANCEL".equals(in.action())) {
            existing.ifPresent(writer::cancel);
            return;
        }
        if ("UPDATE".equals(in.action())) {
            existing.filter(v -> !"CANCELLED".equals(v.getStatus())).ifPresent(v -> {
                if (in.occurredAt() != null) {
                    v.setOccurredAt(in.occurredAt());
                }
                if (in.userId() != null) {
                    v.setCollectorId(in.userId());
                    v.setCollectorName(in.userName());
                }
                v.setNote(in.note());
            });
            return;
        }
        if (existing.isPresent()) {
            return;
        }
        var v = CashbookWriter.newVoucher(in.code(), in.voucherType(), in.fund(), in.category(), in.amount());
        v.setOccurredAt(in.occurredAt());
        v.setBankAccountId(in.bankAccountId());
        v.setBranchId(in.branchId());
        v.setPartnerType(in.partnerType());
        v.setPartnerId(in.partnerId());
        v.setPartnerName(in.partnerName());
        v.setPartnerPhone(in.partnerPhone());
        v.setCollectorId(in.userId());
        v.setCollectorName(in.userName());
        v.setCreatedBy(in.userId());
        v.setCreatedByName(in.userName());
        v.setAccounting(ACCOUNTED_SOURCES.contains(in.sourceType())); // lương / tạm ứng = chi phí; tiền hàng NCC đã vào giá vốn
        v.setSourceType(in.sourceType());
        v.setSourceId(in.sourceId());
        v.setNote(in.note());
        // 2 lần gửi song song: bản sau vi phạm unique(source) → rollback, outbox gửi lại và rơi vào nhánh "đã có" ở trên.
        writer.save(v, List.of());
    }
}
