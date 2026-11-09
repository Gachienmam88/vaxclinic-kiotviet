package com.vaxclinic.sales.invoice.service;

import com.vaxclinic.sales.invoice.entity.Invoice;
import com.vaxclinic.sales.invoice.dto.InvoiceDtos;
import com.vaxclinic.sales.invoice.repository.InvoiceRepository;
import com.vaxclinic.sales.invoice.client.ProductStockClient;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.cashbook.repository.CashVoucherRepository;
import com.vaxclinic.sales.cashbook.service.CashbookWriter;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.customer.entity.Customer;
import com.vaxclinic.sales.customer.repository.CustomerRepository;
import com.vaxclinic.sales.debt.DebtLedger;
import com.vaxclinic.sales.delivery.service.ShipmentInvoiceHooks;
import com.vaxclinic.sales.invoice.dto.InvoiceDtos.InvoiceRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Ghi DB khi sửa hóa đơn (sau khi kho đã SALE_REPLACE), 1 transaction:
 * thay dòng + lô, cập nhật tổng tiền, phiếu thu tự động TT{mã} theo số khách trả mới, sổ công nợ ghi CHÊNH LỆCH,
 * tổng bán của khách; tăng revision. Đổi khách (khi không có phiếu thu nợ): đảo toàn bộ ở khách cũ, ghi mới ở khách mới.
 */
@Component
public class InvoiceEditWriter {

    private final InvoiceRepository invoices;
    private final CustomerRepository customers;
    private final CashVoucherRepository vouchers;
    private final CashbookWriter cashbook;
    private final DebtLedger debt;
    private final InvoiceLineBuilder lineBuilder;
    private final JdbcTemplate jdbc;
    private final ShipmentInvoiceHooks shipments;
    private final InvoiceExtraPayments extraPayments;
    private final InvoiceEvents events;

    public InvoiceEditWriter(InvoiceRepository invoices, CustomerRepository customers, CashVoucherRepository vouchers,
                             CashbookWriter cashbook, DebtLedger debt, InvoiceLineBuilder lineBuilder, JdbcTemplate jdbc,
                             ShipmentInvoiceHooks shipments, InvoiceExtraPayments extraPayments, InvoiceEvents events) {
        this.events = events;
        this.extraPayments = extraPayments;
        this.shipments = shipments;
        this.invoices = invoices;
        this.customers = customers;
        this.vouchers = vouchers;
        this.cashbook = cashbook;
        this.debt = debt;
        this.lineBuilder = lineBuilder;
        this.jdbc = jdbc;
    }

    @Transactional
    public void apply(UUID id, int expectedRevision, UUID stockDocId, InvoiceRequest req, Customer customer,
                      List<UUID> lineIds, ProductStockClient.Result stockResult, InvoiceMath.Totals totals,
                      BigDecimal paid, Actor actor) {
        Invoice inv = invoices.findForUpdate(id).orElseThrow();
        if (inv.getStockDocId().equals(stockDocId)) {
            return; // gửi lại cùng bản sửa: đã ghi xong
        }
        if (inv.getRevision() != expectedRevision) {
            throw BusinessException.conflict("INVOICE_CHANGED", "Hóa đơn vừa được người khác sửa, hãy mở lại để sửa tiếp");
        }
        UUID oldCustomer = inv.getCustomerId();
        BigDecimal oldTotal = inv.getTotal();
        var auto = vouchers.findBySourceTypeAndSourceId("INVOICE", id);
        BigDecimal oldAutoPaid = auto.filter(v -> "PAID".equals(v.getStatus())).map(v -> v.getAmount()).orElse(BigDecimal.ZERO);

        // Dòng hàng: xóa cũ (kèm lô), thêm mới
        inv.getLines().clear();
        invoices.flush();
        lineBuilder.addLines(inv, req.lines(), lineIds, stockResult);
        inv.setCustomerId(customer == null ? null : customer.getId());
        inv.setCustomerName(customer == null ? "Khách lẻ" : customer.getName());
        if (req.sellerId() != null) {
            inv.setSellerId(req.sellerId());
            inv.setSellerName(req.sellerName());
        }
        inv.setSubtotal(totals.subtotal());
        inv.setDiscount(totals.discount());
        inv.setTotal(totals.total());
        inv.setNote(req.note());
        InvoiceWriter.applyMeta(inv, req);
        if (req.delivery() != null) inv.setSaleMode("DELIVERY");
        // paid = phần của phiếu TT{mã}; phiếu thu thêm (thanh toán nhiều phương thức) giữ nguyên → giữ phương thức cũ
        boolean hasExtras = extraPayments.activeTotal(id).signum() > 0;
        inv.setPaymentMethod(paid.signum() > 0 ? (req.paymentMethod() == null ? "CASH" : req.paymentMethod())
                : hasExtras ? inv.getPaymentMethod() : null);
        inv.applyEInvoiceBuyer(req.einvoiceBuyer());
        inv.setRevision(expectedRevision + 1);
        inv.setStockDocId(stockDocId);
        invoices.saveAndFlush(inv);
        lineBuilder.saveLots(stockResult);

        // Phiếu thu tự động TT{mã}: hủy cũ (trả lại phân bổ), tạo lại theo số tiền mới
        auto.filter(v -> "PAID".equals(v.getStatus())).ifPresent(cashbook::cancel);
        jdbc.update("delete from voucher_allocations where invoice_id = ? and voucher_id in "
                + "(select id from cash_vouchers where source_type = 'INVOICE' and source_id = ?)", id, id);
        if (paid.signum() > 0) {
            var v = auto.orElseGet(() -> CashbookWriter.newVoucher("TT" + inv.getCode(), "RECEIPT", "CASH", "Thu Tiền khách trả", paid));
            v.setStatus("PAID");
            v.setAmount(paid);
            v.setFund(InvoiceWriter.fundOf(inv.getPaymentMethod()));
            v.setBankAccountId(req.bankAccountId());
            v.setOccurredAt(inv.getSoldAt());
            v.setBranchId(inv.getBranchId());
            v.setPartnerType("CUSTOMER");
            v.setPartnerId(inv.getCustomerId());
            v.setPartnerName(inv.getCustomerName());
            v.setCollectorId(inv.getSellerId());
            v.setCollectorName(inv.getSellerName());
            v.setCreatedBy(v.getCreatedBy() == null ? actor.id() : v.getCreatedBy());
            v.setCreatedByName(v.getCreatedByName() == null ? actor.name() : v.getCreatedByName());
            v.setAccounting(false);
            v.setAffectsDebt(customer != null);
            v.setSourceType("INVOICE");
            v.setSourceId(id);
            cashbook.save(v, List.of(new CashbookWriter.Allocation(id, paid)));
        }
        shipments.syncOnEdit(inv, req.delivery(), actor); // thu hộ = tổng mới − đã trả mới

        // Công nợ + tổng bán: ghi chênh lệch (cùng khách) hoặc chuyển khách
        Instant now = Instant.now();
        String note = "Sửa hóa đơn " + inv.getCode();
        if (Objects.equals(oldCustomer, inv.getCustomerId())) {
            if (oldCustomer != null) {
                debt.post(oldCustomer, DebtLedger.DocType.SALE, id, inv.getCode(), totals.total().subtract(oldTotal), note, now);
                debt.post(oldCustomer, DebtLedger.DocType.PAYMENT, id, "TT" + inv.getCode(), oldAutoPaid.subtract(paid), note, now);
                addSales(oldCustomer, totals.total().subtract(oldTotal));
            }
        } else {
            if (oldCustomer != null) {
                debt.post(oldCustomer, DebtLedger.DocType.SALE_CANCEL, id, inv.getCode(), oldTotal.negate(), note, now);
                debt.post(oldCustomer, DebtLedger.DocType.PAYMENT_CANCEL, id, "TT" + inv.getCode(), oldAutoPaid, note, now);
                addSales(oldCustomer, oldTotal.negate());
            }
            if (inv.getCustomerId() != null) {
                debt.post(inv.getCustomerId(), DebtLedger.DocType.SALE, id, inv.getCode(), totals.total(), note, now);
                debt.post(inv.getCustomerId(), DebtLedger.DocType.PAYMENT, id, "TT" + inv.getCode(), paid.negate(), note, now);
                addSales(inv.getCustomerId(), totals.total());
            }
        }
        events.updated(inv);
    }

    private void addSales(UUID customerId, BigDecimal delta) {
        Customer c = customers.findById(customerId).orElseThrow();
        c.setTotalSales(c.getTotalSales().add(delta));
    }
}
