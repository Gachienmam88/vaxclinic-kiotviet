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
import com.vaxclinic.sales.invoice.dto.InvoiceDtos.InfoRequest;
import com.vaxclinic.sales.invoice.dto.InvoiceDtos.InvoiceRequest;
import com.vaxclinic.sales.invoice.checkout.service.CheckoutAttemptService;
import com.vaxclinic.sales.order.service.OrderDepositLedger;
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
    private final OrderDepositLedger orderDeposits;
    private final ShipmentInvoiceHooks shipments;
    private final InvoiceExtraPayments extraPayments;
    private final CheckoutAttemptService checkouts;
    private final InvoiceEvents events;

    public InvoiceWriter(InvoiceRepository invoices, CustomerRepository customers, CashVoucherRepository vouchers,
                         CashbookWriter cashbook, DebtLedger debt, InvoiceLineBuilder lineBuilder,
                         OrderDepositLedger orderDeposits, ShipmentInvoiceHooks shipments, InvoiceExtraPayments extraPayments,
                         CheckoutAttemptService checkouts, InvoiceEvents events) {
        this.events = events;
        this.checkouts = checkouts;
        this.extraPayments = extraPayments;
        this.orderDeposits = orderDeposits;
        this.shipments = shipments;
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
        // Cùng transaction: lần thanh toán → DONE. Job đối soát đã nhận hoàn kho lần này → dừng (rollback), không lưu HĐ thiếu kho.
        if (!checkouts.markDone(req.id(), stockResult.docId())) {
            if (invoices.existsById(req.id())) return req.id(); // lần gửi song song khác vừa lưu xong
            throw BusinessException.conflict("CHECKOUT_RECONCILED",
                    "Lần thanh toán này đã được đối soát hoàn kho, vui lòng gửi lại hóa đơn");
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
        inv.setPaymentMethod(paid.signum() > 0 ? (req.paymentMethod() == null ? "CASH" : req.paymentMethod())
                : req.extraPayments() == null || req.extraPayments().isEmpty() ? null : req.extraPayments().get(0).method());
        inv.setNote(req.note());
        inv.setOffline(req.offline());
        inv.applyEInvoiceBuyer(req.einvoiceBuyer());
        inv.setStockDocId(stockResult.docId()); // = id hóa đơn; khác khi trừ kho lại sau đối soát (CheckoutAttemptRules)
        inv.setOrderId(req.orderId());
        applyMeta(inv, req);
        if (req.delivery() != null) inv.setSaleMode("DELIVERY");
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
        var extras = extraPayments.create(inv, customer, req.extraPayments(), actor); // TT{mã}-2, -3...
        if (req.orderId() != null) { // tiền cọc đã giảm công nợ lúc thu → chỉ phân bổ vào hóa đơn, không ghi sổ nợ lần 2
            orderDeposits.attach(req.orderId(), inv);
        }
        shipments.createForInvoice(inv, req.delivery(), actor); // sau phiếu thu + cọc: thu hộ = tổng − đã trả
        if (customer != null) {
            debt.post(customer.getId(), DebtLedger.DocType.SALE, inv.getId(), code, inv.getTotal(), null, inv.getSoldAt());
            if (paid.signum() > 0) {
                debt.post(customer.getId(), DebtLedger.DocType.PAYMENT, inv.getId(), "TT" + code, paid.negate(), null, inv.getSoldAt());
            }
            for (var x : extras) {
                debt.post(customer.getId(), DebtLedger.DocType.PAYMENT, inv.getId(), x.getCode(), x.getAmount().negate(), null, inv.getSoldAt());
            }
            Customer c = customers.findById(customer.getId()).orElseThrow();
            c.setTotalSales(c.getTotalSales().add(inv.getTotal()));
        }
        events.completed(inv); // app.events.enabled: cùng transaction (outbox) → integration tự phát hành HĐĐT nếu bật
        return inv.getId();
    }

    /** Sau khi kho đã hoàn: hủy phiếu thu tự động, ghi giảm công nợ, đánh dấu hủy. */
    /** @return true nếu vừa hủy; false nếu hóa đơn đã hủy từ trước (VD 2 người bấm hủy cùng lúc). */
    @Transactional
    public boolean markCancelled(UUID id, Actor actor) {
        Invoice inv = invoices.findForUpdate(id).orElseThrow();
        if ("CANCELLED".equals(inv.getStatus())) {
            return false;
        }
        var auto = vouchers.findBySourceTypeAndSourceId("INVOICE", id).filter(v -> "PAID".equals(v.getStatus()));
        BigDecimal autoPaid = auto.map(v -> v.getAmount()).orElse(BigDecimal.ZERO);
        auto.ifPresent(cashbook::cancel);
        var extras = extraPayments.cancelAll(id);
        if (inv.getOrderId() != null) {
            orderDeposits.detach(inv);
        }
        inv.setStatus("CANCELLED");
        inv.setCancelledAt(Instant.now());
        shipments.onInvoiceCancelled(inv, actor);
        if (inv.getCustomerId() != null) {
            Instant now = Instant.now();
            debt.post(inv.getCustomerId(), DebtLedger.DocType.SALE_CANCEL, id, inv.getCode(), inv.getTotal().negate(), "Hủy hóa đơn", now);
            if (autoPaid.signum() > 0) {
                debt.post(inv.getCustomerId(), DebtLedger.DocType.PAYMENT_CANCEL, id, "TT" + inv.getCode(), autoPaid, "Hủy phiếu thu", now);
            }
            for (var x : extras) {
                debt.post(inv.getCustomerId(), DebtLedger.DocType.PAYMENT_CANCEL, id, x.getCode(), x.getAmount(), "Hủy phiếu thu", now);
            }
            Customer c = customers.findById(inv.getCustomerId()).orElseThrow();
            c.setTotalSales(c.getTotalSales().subtract(inv.getTotal()));
        }
        events.cancelled(inv);
        return true;
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
        events.updated(inv);
    }

    @Transactional
    /** channel = mã kênh đã kiểm tra (null = giữ nguyên). */
    public void updateInfo(UUID id, InfoRequest req, String channel) {
        Invoice inv = invoices.findById(id)
                .orElseThrow(() -> BusinessException.notFound("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
        if (req.sellerId() != null) {
            inv.setSellerId(req.sellerId());
            inv.setSellerName(req.sellerName());
        }
        if (req.soldAt() != null) {
            inv.setSoldAt(req.soldAt());
        }
        if (channel != null) {
            inv.setSalesChannel(channel);
        }
        inv.setNote(req.note());
        events.updated(inv);
    }

    /** Bảng giá + kênh bán (đã kiểm tra ở InvoiceService); dùng chung khi tạo và sửa hóa đơn. */
    static void applyMeta(Invoice inv, InvoiceRequest req) {
        inv.setPriceBookId(req.priceBookId());
        inv.setPriceBookName(req.priceBookId() == null ? null : Actor.blankToNull(req.priceBookName()));
        inv.setSalesChannel(req.salesChannel() == null || req.salesChannel().isBlank() ? "DIRECT" : req.salesChannel().trim());
    }

    static String fundOf(String method) {
        return switch (method == null ? "CASH" : method) {
            case "TRANSFER", "CARD" -> "BANK";
            case "EWALLET" -> "EWALLET";
            default -> "CASH";
        };
    }
}
