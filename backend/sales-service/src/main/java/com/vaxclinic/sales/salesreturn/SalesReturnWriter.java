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

    @Transactional
    public void persist(ReturnRequest req, Invoice inv, String code, List<SalesReturnService.PlannedLine> lines,
                        BigDecimal subtotal, BigDecimal discount, BigDecimal fee, BigDecimal total, BigDecimal refund,
                        Actor actor) {
        if (exists(req.id())) {
            return;
        }
        Instant at = req.returnedAt() == null ? Instant.now() : req.returnedAt();
        jdbc.update("""
                insert into sales_returns(id, code, invoice_id, branch_id, customer_id, customer_name, created_by, created_by_name,
                    returned_at, status, subtotal, discount, fee, total, refunded, payment_method, note)
                values (?,?,?,?,?,?,?,?,?, 'COMPLETED', ?,?,?,?,?,?,?)""",
                req.id(), code, inv.getId(), inv.getBranchId(), inv.getCustomerId(), inv.getCustomerName(), actor.id(),
                actor.name(), Timestamp.from(at), subtotal, discount, fee, total, refund,
                refund.signum() > 0 ? (req.paymentMethod() == null ? "CASH" : req.paymentMethod()) : null, req.note());
        for (var l : lines) {
            var il = l.invoiceLine();
            String lots = l.lots().entrySet().stream().filter(e -> !e.getKey().isEmpty())
                    .map(e -> e.getKey() + ":" + e.getValue().setScale(0, RoundingMode.DOWN).toPlainString())
                    .collect(Collectors.joining(", "));
            jdbc.update("""
                    insert into sales_return_lines(id, return_id, invoice_line_id, product_id, product_code, product_name,
                        unit_name, quantity, unit_price, lots) values (?,?,?,?,?,?,?,?,?,?)""",
                    l.lineId(), req.id(), il.getId(), il.getProductId(), il.getProductCode(), il.getProductName(),
                    il.getUnitName(), l.quantity(), l.unitPrice(), lots.isEmpty() ? null : lots);
            l.lots().forEach((lot, qty) -> jdbc.update(
                    "insert into sales_return_line_lots(return_line_id, lot_number, base_qty) values (?,?,?)", l.lineId(), lot, qty));
        }
        if (refund.signum() > 0) {
            String method = req.paymentMethod() == null ? "CASH" : req.paymentMethod();
            var v = CashbookWriter.newVoucher("PC" + code, "PAYMENT",
                    "TRANSFER".equals(method) || "CARD".equals(method) ? "BANK" : "EWALLET".equals(method) ? "EWALLET" : "CASH",
                    "Chi Tiền trả khách", refund);
            v.setOccurredAt(at);
            v.setBranchId(inv.getBranchId());
            v.setPartnerType("CUSTOMER");
            v.setPartnerId(inv.getCustomerId());
            v.setPartnerName(inv.getCustomerName());
            v.setCollectorId(actor.id());
            v.setCollectorName(actor.name());
            v.setCreatedBy(actor.id());
            v.setCreatedByName(actor.name());
            v.setAccounting(false); // đã phản ánh qua giá trị hàng trả
            v.setAffectsDebt(inv.getCustomerId() != null);
            v.setSourceType("RETURN");
            v.setSourceId(req.id());
            v.setNote("Trả hàng " + code + " / " + inv.getCode());
            cashbook.save(v, List.of());
        }
        if (inv.getCustomerId() != null) {
            debt.post(inv.getCustomerId(), DebtLedger.DocType.RETURN, req.id(), code, total.negate(), "Trả hàng " + inv.getCode(), at);
            debt.post(inv.getCustomerId(), DebtLedger.DocType.REFUND, req.id(), "PC" + code, refund, null, at);
            var c = customers.findById(inv.getCustomerId()).orElseThrow();
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
