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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Bán hàng:
 * 1) Trừ kho ở product-service (idempotent theo id hóa đơn — gọi lại an toàn).
 * 2) Trong 1 transaction: lưu hóa đơn, phiếu thu "TT"+mã HĐ (nếu khách trả tiền), sổ công nợ (bán − đã trả).
 * Gửi lại cùng id (đồng bộ offline, mạng chập chờn) → trả hóa đơn đã có, không tạo trùng.
 */
@Service
public class InvoiceService {

    private final InvoiceRepository invoices;
    private final CustomerRepository customers;
    private final CashVoucherRepository vouchers;
    private final CashbookWriter cashbook;
    private final DebtLedger debt;
    private final ProductStockClient stock;

    public InvoiceService(InvoiceRepository invoices, CustomerRepository customers, CashVoucherRepository vouchers,
                          CashbookWriter cashbook, DebtLedger debt, ProductStockClient stock) {
        this.invoices = invoices;
        this.customers = customers;
        this.vouchers = vouchers;
        this.cashbook = cashbook;
        this.debt = debt;
        this.stock = stock;
    }

    /** Không @Transactional ở đây: gọi kho (HTTP) trước, rồi mới mở transaction lưu hóa đơn. */
    public UUID create(InvoiceRequest req, Actor actor, InvoiceService self) {
        if (invoices.existsById(req.id())) {
            return req.id();
        }
        actor.checkBranch(req.branchId());
        Customer customer = req.customerId() == null ? null : customers.findById(req.customerId())
                .orElseThrow(() -> BusinessException.badRequest("CUSTOMER_NOT_FOUND", "Khách hàng không tồn tại"));
        var totals = InvoiceMath.totals(req.lines(), req.discount());
        BigDecimal paid = InvoiceMath.money(req.paidAmount() == null ? totals.total() : req.paidAmount()).min(totals.total());
        if (customer == null && paid.compareTo(totals.total()) < 0) {
            throw BusinessException.badRequest("WALK_IN_DEBT", "Khách lẻ phải thanh toán đủ — chọn khách hàng để ghi nợ");
        }
        // Mã HĐ lấy trước để ghi vào thẻ kho; nếu bước sau lỗi, mã bị bỏ qua (dãy số có thể nhảy cóc).
        String code = "HD%06d".formatted(invoices.nextCodeNumber());
        var lineIds = req.lines().stream().map(l -> UUID.randomUUID()).toList();
        var stockLines = java.util.stream.IntStream.range(0, req.lines().size()).mapToObj(i -> {
            var l = req.lines().get(i);
            return new ProductStockClient.Line(lineIds.get(i), l.productId(), l.unitId(), l.quantity());
        }).toList();
        var result = stock.apply(new ProductStockClient.Request(req.id(), "SALE", code, req.branchId(),
                customer == null ? "Khách lẻ" : customer.getName(), actor.id(), stockLines));
        return self.persist(req, actor, customer, code, lineIds, result, totals, paid);
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
        var byLine = stockResult.lines().stream().collect(Collectors.toMap(ProductStockClient.LineResult::lineId, r -> r));
        for (int i = 0; i < req.lines().size(); i++) {
            var in = req.lines().get(i);
            var sr = byLine.get(lineIds.get(i));
            var line = new InvoiceLine();
            line.setId(lineIds.get(i));
            line.setInvoice(inv);
            line.setLineNo(i + 1);
            line.setProductId(in.productId());
            line.setUnitId(in.unitId());
            line.setProductCode(in.productCode());
            line.setProductName(in.productName());
            line.setUnitName(in.unitName());
            line.setQuantity(in.quantity());
            line.setUnitPrice(in.unitPrice());
            line.setDiscount(in.discount() == null ? BigDecimal.ZERO : in.discount());
            line.setCost(sr == null ? BigDecimal.ZERO : sr.unitCost());
            line.setLots(sr == null ? null : describeLots(sr));
            line.setNote(in.note());
            inv.getLines().add(line);
        }
        invoices.saveAndFlush(inv);

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

    /** Hủy hóa đơn: hoàn kho đúng các lô đã xuất, hủy phiếu thu tự động, ghi giảm công nợ. */
    public void cancel(UUID id, Actor actor, InvoiceService self) {
        Invoice inv = find(id);
        if ("CANCELLED".equals(inv.getStatus())) {
            return;
        }
        actor.checkBranch(inv.getBranchId());
        stock.apply(new ProductStockClient.Request(id, "SALE_CANCEL", inv.getCode(), inv.getBranchId(),
                inv.getCustomerName(), actor.id(), List.of()));
        self.markCancelled(id);
    }

    @Transactional
    public void markCancelled(UUID id) {
        Invoice inv = invoices.findForUpdate(id).orElseThrow();
        if ("CANCELLED".equals(inv.getStatus())) {
            return;
        }
        var auto = vouchers.findBySourceTypeAndSourceId("INVOICE", id);
        BigDecimal autoPaid = auto.filter(v -> "PAID".equals(v.getStatus())).map(v -> v.getAmount()).orElse(BigDecimal.ZERO);
        auto.ifPresent(cashbook::cancel);
        if (inv.getPaid().signum() > 0) {
            throw BusinessException.badRequest("INVOICE_HAS_PAYMENTS",
                    "Hóa đơn đã có phiếu thu nợ phân bổ, hãy hủy các phiếu thu đó trước");
        }
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
    public void updateInfo(UUID id, InfoRequest req) {
        Invoice inv = find(id);
        if (req.sellerId() != null) {
            inv.setSellerId(req.sellerId());
            inv.setSellerName(req.sellerName());
        }
        if (req.soldAt() != null) {
            inv.setSoldAt(req.soldAt());
        }
        inv.setNote(req.note());
    }

    public Invoice find(UUID id) {
        return invoices.findById(id)
                .orElseThrow(() -> BusinessException.notFound("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
    }

    static String fundOf(String method) {
        return switch (method == null ? "CASH" : method) {
            case "TRANSFER", "CARD" -> "BANK";
            case "EWALLET" -> "EWALLET";
            default -> "CASH";
        };
    }

    private static String describeLots(ProductStockClient.LineResult r) {
        return r.allocations().stream().filter(a -> a.lotNumber() != null)
                .map(a -> a.lotNumber() + ":" + a.baseQuantity().setScale(0, RoundingMode.DOWN).toPlainString())
                .collect(Collectors.joining(", "));
    }
}
