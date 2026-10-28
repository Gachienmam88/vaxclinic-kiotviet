package com.vaxclinic.sales.salesreturn;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.cashbook.CashVoucherRepository;
import com.vaxclinic.sales.cashbook.CashbookWriter;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.customer.CustomerRepository;
import com.vaxclinic.sales.debt.DebtLedger;
import com.vaxclinic.sales.invoice.Invoice;
import com.vaxclinic.sales.salesreturn.SalesReturnDtos.ReturnRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Ghi phiếu trả hàng (sau khi kho đã nhập lại), 1 transaction:
 * phiếu + dòng + lô, phiếu chi "PC"+mã (tiền trả khách ngay), sổ công nợ (RETURN −tổng, REFUND +đã chi), tổng trả của khách.
 */
@Component
public class SalesReturnWriter {

    private final JdbcTemplate jdbc;
    private final CashVoucherRepository vouchers;
    private final CashbookWriter cashbook;
    private final DebtLedger debt;
    private final CustomerRepository customers;

    public SalesReturnWriter(JdbcTemplate jdbc, CashVoucherRepository vouchers, CashbookWriter cashbook, DebtLedger debt,
                             CustomerRepository customers) {
        this.jdbc = jdbc;
        this.vouchers = vouchers;
        this.cashbook = cashbook;
        this.debt = debt;
        this.customers = customers;
    }

    public boolean exists(UUID id) {
        Integer n = jdbc.queryForObject("select count(*) from sales_returns where id = ?", Integer.class, id);
        return n != null && n > 0;
    }

    public Map<String, Object> find(UUID id) {
        var rows = jdbc.queryForList("select * from sales_returns where id = ?", id);
        if (rows.isEmpty()) {
            throw BusinessException.notFound("RETURN_NOT_FOUND", "Không tìm thấy phiếu trả hàng");
        }
        return rows.get(0);
    }

    /** Chứng từ gốc của phiếu trả: hóa đơn (trả theo hóa đơn) hoặc không (invoiceId null = trả nhanh). */
    public record Header(UUID invoiceId, String invoiceCode, UUID branchId, UUID customerId, String customerName) {
    }

    /** 1 dòng phiếu trả: lô nhập lại theo đơn vị cơ bản; cost = giá vốn / 1 đơn vị trả (null = theo dòng hóa đơn). */
    public record Row(UUID lineId, UUID invoiceLineId, UUID productId, String productCode, String productName,
                      String unitName, BigDecimal quantity, BigDecimal unitPrice, Map<String, BigDecimal> lots,
                      BigDecimal cost) {
    }

    /** Trả theo hóa đơn. */
    @Transactional
    public void persist(ReturnRequest req, Invoice inv, String code, List<SalesReturnService.PlannedLine> lines,
                        BigDecimal subtotal, BigDecimal discount, BigDecimal fee, BigDecimal total, BigDecimal refund,
                        Actor actor) {
        var rows = lines.stream().map(l -> new Row(l.lineId(), l.invoiceLine().getId(), l.invoiceLine().getProductId(),
                l.invoiceLine().getProductCode(), l.invoiceLine().getProductName(), l.invoiceLine().getUnitName(), l.quantity(),
                l.unitPrice(), l.lots(), l.invoiceLine().getCost())).toList();
        persist(req, new Header(inv.getId(), inv.getCode(), inv.getBranchId(), inv.getCustomerId(), inv.getCustomerName()),
                code, rows, subtotal, discount, fee, total, refund, actor);
    }

    @Transactional
    public void persist(ReturnRequest req, Header h, String code, List<Row> rows, BigDecimal subtotal, BigDecimal discount,
                        BigDecimal fee, BigDecimal total, BigDecimal refund, Actor actor) {
        if (exists(req.id())) {
            return;
        }
        Instant at = req.returnedAt() == null ? Instant.now() : req.returnedAt();
        jdbc.update("""
                insert into sales_returns(id, code, invoice_id, branch_id, customer_id, customer_name, created_by, created_by_name,
                    returned_at, status, subtotal, discount, fee, total, refunded, payment_method, note)
                values (?,?,?,?,?,?,?,?,?, 'COMPLETED', ?,?,?,?,?,?,?)""",
                req.id(), code, h.invoiceId(), h.branchId(), h.customerId(), h.customerName(), actor.id(),
                actor.name(), Timestamp.from(at), subtotal, discount, fee, total, refund,
                refund.signum() > 0 ? (req.paymentMethod() == null ? "CASH" : req.paymentMethod()) : null, req.note());
        for (var l : rows) {
            String lots = l.lots().entrySet().stream().filter(e -> !e.getKey().isEmpty())
                    .map(e -> e.getKey() + ":" + e.getValue().setScale(0, RoundingMode.DOWN).toPlainString())
                    .collect(Collectors.joining(", "));
            jdbc.update("""
                    insert into sales_return_lines(id, return_id, invoice_line_id, product_id, product_code, product_name,
                        unit_name, quantity, unit_price, lots, cost) values (?,?,?,?,?,?,?,?,?,?,?)""",
                    l.lineId(), req.id(), l.invoiceLineId(), l.productId(), l.productCode(), l.productName(),
                    l.unitName(), l.quantity(), l.unitPrice(), lots.isEmpty() ? null : lots, l.cost());
            l.lots().forEach((lot, qty) -> jdbc.update(
                    "insert into sales_return_line_lots(return_line_id, lot_number, base_qty) values (?,?,?)", l.lineId(), lot, qty));
        }
        String docNote = h.invoiceId() == null ? "Trả nhanh " + code : "Trả hàng " + code + " / " + h.invoiceCode();
        if (refund.signum() > 0) {
            String method = req.paymentMethod() == null ? "CASH" : req.paymentMethod();
            var v = CashbookWriter.newVoucher("PC" + code, "PAYMENT",
                    "TRANSFER".equals(method) || "CARD".equals(method) ? "BANK" : "EWALLET".equals(method) ? "EWALLET" : "CASH",
                    "Chi Tiền trả khách", refund);
            v.setBankAccountId(req.bankAccountId());
            v.setOccurredAt(at);
            v.setBranchId(h.branchId());
            v.setPartnerType("CUSTOMER");
            v.setPartnerId(h.customerId());
            v.setPartnerName(h.customerName());
            v.setCollectorId(actor.id());
            v.setCollectorName(actor.name());
            v.setCreatedBy(actor.id());
            v.setCreatedByName(actor.name());
            v.setAccounting(false); // đã phản ánh qua giá trị hàng trả
            v.setAffectsDebt(h.customerId() != null);
            v.setSourceType("RETURN");
            v.setSourceId(req.id());
            v.setNote(docNote);
            cashbook.save(v, List.of());
        }
        if (h.customerId() != null) {
            debt.post(h.customerId(), DebtLedger.DocType.RETURN, req.id(), code, total.negate(),
                    h.invoiceId() == null ? "Trả nhanh" : "Trả hàng " + h.invoiceCode(), at);
            debt.post(h.customerId(), DebtLedger.DocType.REFUND, req.id(), "PC" + code, refund, null, at);
            var c = customers.findById(h.customerId()).orElseThrow();
            c.setTotalReturns(c.getTotalReturns().add(total));
        }
    }

    @Transactional
    public void markCancelled(UUID id) {
        var r = jdbc.queryForMap("select * from sales_returns where id = ? for update", id);
        if ("CANCELLED".equals(r.get("status"))) {
            return;
        }
        jdbc.update("update sales_returns set status = 'CANCELLED', cancelled_at = now() where id = ?", id);
        vouchers.findBySourceTypeAndSourceId("RETURN", id).ifPresent(cashbook::cancel);
        UUID customerId = (UUID) r.get("customer_id");
        if (customerId != null) {
            BigDecimal total = (BigDecimal) r.get("total");
            BigDecimal refunded = (BigDecimal) r.get("refunded");
            Instant now = Instant.now();
            debt.post(customerId, DebtLedger.DocType.RETURN_CANCEL, id, (String) r.get("code"), total, "Hủy phiếu trả hàng", now);
            debt.post(customerId, DebtLedger.DocType.REFUND_CANCEL, id, "PC" + r.get("code"), refunded.negate(), null, now);
            var c = customers.findById(customerId).orElseThrow();
            c.setTotalReturns(c.getTotalReturns().subtract(total));
        }
    }
}
