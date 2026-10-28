package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.cashbook.CashVoucherRepository;
import com.vaxclinic.sales.cashbook.CashbookWriter;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.customer.Customer;
import com.vaxclinic.sales.customer.CustomerRepository;
import com.vaxclinic.sales.debt.DebtLedger;
import com.vaxclinic.sales.invoice.InvoiceDtos.InfoRequest;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/** Phần ghi DB của bán hàng — mỗi method là 1 transaction: hóa đơn + phiếu thu + sổ công nợ cùng commit. */
@Component
public class InvoiceWriter {

    private final InvoiceRepository invoices;
    private final CustomerRepository customers;
    private final CashVoucherRepository vouchers;
    private final CashbookWriter cashbook;
    private final DebtLedger debt;
    private final InvoiceLineBuilder lineBuilder;

    public InvoiceWriter(InvoiceRepository invoices, CustomerRepository customers, CashVoucherRepository vouchers,
                         CashbookWriter cashbook, DebtLedger debt, InvoiceLineBuilder lineBuilder) {
        this.invoices = invoices;
        this.customers = customers;
        this.vouchers = vouchers;
        this.cashbook = cashbook;
        this.debt = debt;
        this.lineBuilder = lineBuilder;
    }

    @Transactional
    public UUID persist(InvoiceRequest req, Actor actor, Customer customer, String code, List<UUID> lineIds,
                        ProductStockClient.Result stockResult, InvoiceMath.Totals totals, BigDecimal paid) {
        if (invoices.existsById(req.id())) { // 2 lần gửi chạy song song: lần sau dừng ở đây
            return req.id();
        }
        var inv = new Invoice();
        inv.setId(req.id());
        inv.setCode(code);
        inv.setBranchId(req.branchId());
        inv.setCustomerId(customer == null ? null : customer.getId());
        inv.setCustomerName(customer == null ? "Khách lẻ" : customer.getName());
        inv.setSellerId(req.sellerId() == null ? actor.id() : req.sellerId());
        inv.setSellerName(req.sellerId() == null ? actor.name() : req.sellerName());
        inv.setCreatedBy(actor.id());
        inv.setCreatedByName(actor.name());
        inv.setSoldAt(req.soldAt() == null ? Instant.now() : req.soldAt());
        inv.setSaleMode(req.saleMode() == null ? "QUICK" : req.saleMode());
        inv.setSubtotal(totals.subtotal());
        inv.setDiscount(totals.discount());
        inv.setTotal(totals.total());
        inv.setPaymentMethod(paid.signum() > 0 ? (req.paymentMethod() == null ? "CASH" : req.paymentMethod()) : null);
        inv.setNote(req.note());
        inv.setOffline(req.offline());
        inv.setStockDocId(req.id()); // chứng từ kho đầu tiên dùng chính id hóa đơn
        lineBuilder.addLines(inv, req.lines(), lineIds, stockResult);
        invoices.saveAndFlush(inv); // Invoice implements Persistable → persist (INSERT), entity stays managed
        lineBuilder.saveLots(stockResult);

        if (paid.signum() > 0) {
            var v = CashbookWriter.newVoucher("TT" + code, "RECEIPT", fundOf(inv.getPaymentMethod()), "Thu Tiền khách trả", paid);
            v.setBankAccountId(req.bankAccountId());
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
            v.setAccounting(false); // tiền bán hàng đã nằm trong doanh thu hóa đơn, không hạch toán lần 2
            v.setAffectsDebt(customer != null);
            v.setSourceType("INVOICE");
            v.setSourceId(inv.getId());
            cashbook.save(v, List.of(new CashbookWriter.Allocation(inv.getId(), paid)));
        }
        if (customer != null) {
            debt.post(customer.getId(), DebtLedger.DocType.SALE, inv.getId(), code, inv.getTotal(), null, inv.getSoldAt());
            if (paid.signum() > 0) {
                debt.post(customer.getId(), DebtLedger.DocType.PAYMENT, inv.getId(), "TT" + code, paid.negate(), null, inv.getSoldAt());
            }
            Customer c = customers.findById(customer.getId()).orElseThrow();
            c.setTotalSales(c.getTotalSales().add(inv.getTotal()));
        }
        return inv.getId();
    }

    /** Sau khi kho đã hoàn: hủy phiếu thu tự động, ghi giảm công nợ, đánh dấu hủy. */
    @Transactional
    public void markCancelled(UUID id) {
        Invoice inv = invoices.findForUpdate(id).orElseThrow();
        if ("CANCELLED".equals(inv.getStatus())) {
            return;
        }
        var auto = vouchers.findBySourceTypeAndSourceId("INVOICE", id).filter(v -> "PAID".equals(v.getStatus()));
        BigDecimal autoPaid = auto.map(v -> v.getAmount()).orElse(BigDecimal.ZERO);
        auto.ifPresent(cashbook::cancel);
        inv.setStatus("CANCELLED");
        inv.setCancelledAt(Instant.now());
        if (inv.getCustomerId() != null) {
            Instant now = Instant.now();
            debt.post(inv.getCustomerId(), DebtLedger.DocType.SALE_CANCEL, id, inv.getCode(), inv.getTotal().negate(), "Hủy hóa đơn", now);
            if (autoPaid.signum() > 0) {
                debt.post(inv.getCustomerId(), DebtLedger.DocType.PAYMENT_CANCEL, id, "TT" + inv.getCode(), autoPaid, "Hủy phiếu thu", now);
            }
            Customer c = customers.findById(inv.getCustomerId()).orElseThrow();
            c.setTotalSales(c.getTotalSales().subtract(inv.getTotal()));
        }
    }

    @Transactional
    public void updateTaxCodes(UUID id, List<InvoiceDtos.TaxCodeChange> changes) {
        Invoice inv = invoices.findById(id)
                .orElseThrow(() -> BusinessException.notFound("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
        for (var c : changes) {
            inv.getLines().stream().filter(l -> l.getId().equals(c.lineId())).findFirst()
                    .orElseThrow(() -> BusinessException.badRequest("LINE_NOT_FOUND", "Dòng hàng không thuộc hóa đơn"))
                    .setTaxCode(c.taxCode());
        }
    }

    @Transactional
    public void updateInfo(UUID id, InfoRequest req) {
        Invoice inv = invoices.findById(id)
                .orElseThrow(() -> BusinessException.notFound("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
        if (req.sellerId() != null) {
            inv.setSellerId(req.sellerId());
            inv.setSellerName(req.sellerName());
        }
        if (req.soldAt() != null) {
            inv.setSoldAt(req.soldAt());
        }
        inv.setNote(req.note());
    }

    static String fundOf(String method) {
        return switch (method == null ? "CASH" : method) {
            case "TRANSFER", "CARD" -> "BANK";
            case "EWALLET" -> "EWALLET";
            default -> "CASH";
        };
    }
}
