package com.vaxclinic.sales.debt;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.cashbook.CashVoucherRepository;
import com.vaxclinic.sales.cashbook.CashbookWriter;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.customer.Customer;
import com.vaxclinic.sales.customer.CustomerRepository;
import com.vaxclinic.sales.invoice.InvoiceRepository;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Nợ cần thu từ khách (tab trong chi tiết khách hàng):
 * - Thanh toán: phiếu thu PTxxxxxx, giảm nợ; "Phân bổ vào hóa đơn" = trả cho các HĐ còn nợ (chỉ định hoặc cũ trước).
 * - Điều chỉnh: đặt lại dư nợ về giá trị mới (ghi chênh lệch), không phát sinh tiền.
 * - Chiết khấu thanh toán: giảm nợ không thu tiền (bớt cho khách), có thể phân bổ vào hóa đơn.
 */
@Service
public class DebtService {

    public record AllocationInput(@NotNull UUID invoiceId, @NotNull @DecimalMin("0") BigDecimal amount) {
    }

    /** allocations = null + allocate = true → tự phân bổ hóa đơn cũ trước. */
    public record PaymentRequest(@NotNull UUID branchId, Instant occurredAt, UUID collectorId, String collectorName,
                                 String paymentMethod, UUID bankAccountId,
                                 @NotNull @DecimalMin(value = "1", message = "Số tiền phải lớn hơn 0") BigDecimal amount,
                                 String note, boolean allocate, List<AllocationInput> allocations) {
    }

    public record AdjustRequest(Instant occurredAt, @NotNull BigDecimal newDebt, String note) {
    }

    private final CustomerRepository customers;
    private final InvoiceRepository invoices;
    private final CashVoucherRepository vouchers;
    private final CashbookWriter cashbook;
    private final DebtLedger ledger;
    private final DebtLedgerRepository entries;
    private final com.vaxclinic.sales.common.SalesRules rules;

    public DebtService(CustomerRepository customers, InvoiceRepository invoices, CashVoucherRepository vouchers,
                       CashbookWriter cashbook, DebtLedger ledger, DebtLedgerRepository entries,
                       com.vaxclinic.sales.common.SalesRules rules) {
        this.rules = rules;
        this.customers = customers;
        this.invoices = invoices;
        this.vouchers = vouchers;
        this.cashbook = cashbook;
        this.ledger = ledger;
        this.entries = entries;
    }

    @Transactional
    public String pay(UUID customerId, PaymentRequest req, Actor actor) {
        actor.checkBranch(req.branchId());
        Customer c = customer(customerId);
        Instant at = req.occurredAt() == null ? Instant.now() : req.occurredAt();
        rules.checkNotLocked(req.branchId(), at);
        String code = "PT%06d".formatted(vouchers.nextReceiptNumber());
        var v = CashbookWriter.newVoucher(code, "RECEIPT", fundOf(req.paymentMethod()), "Thu Tiền khách trả", req.amount());
        v.setBankAccountId(req.bankAccountId());
        v.setOccurredAt(at);
        v.setBranchId(req.branchId());
        v.setPartnerType("CUSTOMER");
        v.setPartnerId(c.getId());
        v.setPartnerName(c.getName());
        v.setPartnerPhone(c.getPhone());
        v.setCollectorId(req.collectorId() == null ? actor.id() : req.collectorId());
        v.setCollectorName(req.collectorId() == null ? actor.name() : req.collectorName());
        v.setCreatedBy(actor.id());
        v.setCreatedByName(actor.name());
        v.setAccounting(false);
        v.setAffectsDebt(true);
        v.setSourceType("DEBT");
        v.setSourceId(c.getId());
        v.setNote(req.note());
        cashbook.save(v, req.allocate() ? allocations(c.getId(), req.amount(), req.allocations()) : List.of());
        ledger.post(c.getId(), req.branchId(), DebtLedger.DocType.PAYMENT, v.getId(), code, req.amount().negate(), req.note(), at);
        return code;
    }

    @Transactional
    public String discount(UUID customerId, PaymentRequest req, Actor actor) {
        Customer c = customer(customerId);
        Instant at = req.occurredAt() == null ? Instant.now() : req.occurredAt();
        String code = "CKTT%06d".formatted(entries.nextDiscountNumber());
        if (req.allocate()) { // chiết khấu cũng có thể "trả" cho hóa đơn (không có phiếu thu → ghi thẳng paid)
            for (var a : allocations(c.getId(), req.amount(), req.allocations())) {
                var inv = invoices.findForUpdate(a.invoiceId()).orElseThrow();
                inv.setPaid(inv.getPaid().add(a.amount()));
            }
        }
        ledger.post(c.getId(), req.branchId(), DebtLedger.DocType.DISCOUNT, null, code, req.amount().negate(), req.note(), at);
        return code;
    }

    @Transactional
    public String adjust(UUID customerId, AdjustRequest req) {
        Customer c = customers.findForUpdate(customerId).orElseThrow();
        String code = "DC%06d".formatted(entries.nextAdjustNumber());
        ledger.post(c.getId(), null, DebtLedger.DocType.ADJUST, null, code, req.newDebt().subtract(c.getDebt()), req.note(),
                req.occurredAt() == null ? Instant.now() : req.occurredAt());
        return code;
    }

    /** Phân bổ chỉ định, hoặc tự động cho hóa đơn còn nợ cũ trước tới khi hết tiền. */
    private List<CashbookWriter.Allocation> allocations(UUID customerId, BigDecimal amount, List<AllocationInput> given) {
        if (given != null && !given.isEmpty()) {
            return given.stream().map(a -> new CashbookWriter.Allocation(a.invoiceId(), a.amount())).toList();
        }
        var out = new ArrayList<CashbookWriter.Allocation>();
        BigDecimal left = amount;
        for (var inv : invoices.findUnpaidByCustomer(customerId)) {
            if (left.signum() <= 0) {
                break;
            }
            BigDecimal take = left.min(inv.getTotal().subtract(inv.getPaid()));
            out.add(new CashbookWriter.Allocation(inv.getId(), take));
            left = left.subtract(take);
        }
        return out;
    }

    private Customer customer(UUID id) {
        return customers.findById(id)
                .orElseThrow(() -> BusinessException.notFound("CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng"));
    }

    private static String fundOf(String method) {
        return "TRANSFER".equals(method) || "CARD".equals(method) ? "BANK" : "EWALLET".equals(method) ? "EWALLET" : "CASH";
    }
}
