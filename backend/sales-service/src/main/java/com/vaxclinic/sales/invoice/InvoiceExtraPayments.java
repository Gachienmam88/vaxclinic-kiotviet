package com.vaxclinic.sales.invoice;

import com.vaxclinic.sales.cashbook.CashVoucher;
import com.vaxclinic.sales.cashbook.CashVoucherRepository;
import com.vaxclinic.sales.cashbook.CashbookWriter;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.customer.Customer;
import com.vaxclinic.sales.invoice.InvoiceDtos.ExtraPayment;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Thanh toán nhiều phương thức: các khoản ngoài phương thức chính = phiếu thu TT{mã}-2, TT{mã}-3... (source_type
 * INVOICE_EXTRA, source_id = hóa đơn), phân bổ vào hóa đơn như phiếu TT{mã}. Chỉ tạo khi lập hóa đơn mới;
 * sửa hóa đơn giữ nguyên; hủy hóa đơn hủy hết.
 */
@Component
public class InvoiceExtraPayments {

    public static final String SOURCE = "INVOICE_EXTRA";

    private final CashVoucherRepository vouchers;
    private final CashbookWriter cashbook;
    private final InvoicePaymentRepository payments;

    public InvoiceExtraPayments(CashVoucherRepository vouchers, CashbookWriter cashbook, InvoicePaymentRepository payments) {
        this.vouchers = vouchers;
        this.cashbook = cashbook;
        this.payments = payments;
    }

    /** Tổng các khoản thanh toán thêm của request (làm tròn đồng). */
    public static BigDecimal sum(List<ExtraPayment> extras) {
        return extras == null ? BigDecimal.ZERO : extras.stream().map(e -> InvoiceMath.money(e.amount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Tạo phiếu thu + phân bổ vào hóa đơn (gọi trong transaction lập hóa đơn). Trả về các phiếu đã tạo. */
    @Transactional(propagation = Propagation.MANDATORY)
    public List<CashVoucher> create(Invoice inv, Customer customer, List<ExtraPayment> extras, Actor actor) {
        var out = new ArrayList<CashVoucher>();
        if (extras == null) {
            return out;
        }
        int n = 2;
        for (ExtraPayment e : extras) {
            BigDecimal amount = InvoiceMath.money(e.amount());
            var v = CashbookWriter.newVoucher("TT" + inv.getCode() + "-" + n++, "RECEIPT", InvoiceWriter.fundOf(e.method()),
                    "Thu Tiền khách trả", amount);
            v.setBankAccountId(e.bankAccountId());
            v.setOccurredAt(inv.getSoldAt());
            v.setBranchId(inv.getBranchId());
            v.setPartnerType("CUSTOMER");
            v.setPartnerId(inv.getCustomerId());
            v.setPartnerName(inv.getCustomerName());
            v.setPartnerPhone(customer == null ? null : customer.getPhone());
            v.setCollectorId(inv.getSellerId());
            v.setCollectorName(inv.getSellerName());
            v.setCreatedBy(actor.id());
            v.setCreatedByName(actor.name());
            v.setAccounting(false); // như TT{mã}: tiền bán hàng đã nằm trong doanh thu hóa đơn
            v.setAffectsDebt(customer != null);
            v.setSourceType(SOURCE);
            v.setSourceId(inv.getId());
            v.setNote("Thanh toán nhiều phương thức hóa đơn " + inv.getCode());
            out.add(cashbook.save(v, List.of(new CashbookWriter.Allocation(inv.getId(), amount))));
        }
        return out;
    }

    /** Tổng các phiếu thu thêm còn hiệu lực của hóa đơn. */
    public BigDecimal activeTotal(UUID invoiceId) {
        return payments.activeTotal(SOURCE, invoiceId);
    }

    /** Hủy hóa đơn: hủy mọi phiếu thu thêm còn hiệu lực (trả lại phân bổ). Trả về các phiếu vừa hủy. */
    @Transactional(propagation = Propagation.MANDATORY)
    public List<CashVoucher> cancelAll(UUID invoiceId) {
        var out = new ArrayList<CashVoucher>();
        for (CashVoucher v : vouchers.findBySourceTypeAndSourceIdOrderByCodeAsc(SOURCE, invoiceId)) {
            if ("PAID".equals(v.getStatus())) {
                cashbook.cancel(v);
                out.add(v);
            }
        }
        return out;
    }
}
