package com.vaxclinic.sales.cashbook.service;

import com.vaxclinic.sales.cashbook.entity.CashVoucher;
import com.vaxclinic.sales.cashbook.repository.CashVoucherRepository;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.invoice.entity.Invoice;
import com.vaxclinic.sales.invoice.repository.InvoiceRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Ghi phiếu thu/chi và phân bổ phiếu thu vào hóa đơn (invoices.paid luôn = Σ phân bổ của phiếu còn hiệu lực).
 * Dùng chung cho: thu tiền lúc bán, thu nợ khách, phiếu tạo tay, phiếu chi trả NCC từ outbox.
 */
@Component
public class CashbookWriter {

    public record Allocation(UUID invoiceId, BigDecimal amount) {
    }

    private final CashVoucherRepository vouchers;
    private final InvoiceRepository invoices;
    private final JdbcTemplate jdbc;

    public CashbookWriter(CashVoucherRepository vouchers, InvoiceRepository invoices, JdbcTemplate jdbc) {
        this.vouchers = vouchers;
        this.invoices = invoices;
        this.jdbc = jdbc;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public CashVoucher save(CashVoucher v, List<Allocation> allocations) {
        if (v.getAmount() == null || v.getAmount().signum() <= 0) {
            throw BusinessException.badRequest("AMOUNT_INVALID", "Số tiền phải lớn hơn 0");
        }
        BigDecimal allocated = allocations.stream().map(Allocation::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (allocated.compareTo(v.getAmount()) > 0) {
            throw BusinessException.badRequest("ALLOCATION_EXCEEDS", "Tổng phân bổ lớn hơn số tiền phiếu");
        }
        v = vouchers.saveAndFlush(v); // assigned UUID → merge returns the managed copy; keep using it
        for (var a : allocations) {
            if (a.amount().signum() <= 0) {
                continue;
            }
            Invoice inv = invoices.findForUpdate(a.invoiceId())
                    .orElseThrow(() -> BusinessException.badRequest("INVOICE_NOT_FOUND", "Hóa đơn không tồn tại"));
            if (!"COMPLETED".equals(inv.getStatus()) || inv.getPaid().add(a.amount()).compareTo(inv.getTotal()) > 0) {
                throw BusinessException.badRequest("ALLOCATION_INVALID", "Hóa đơn " + inv.getCode() + " không cần thu số tiền này");
            }
            inv.setPaid(inv.getPaid().add(a.amount()));
            jdbc.update("insert into voucher_allocations(voucher_id, invoice_id, amount) values (?,?,?)",
                    v.getId(), inv.getId(), a.amount());
        }
        return v;
    }

    /** Hủy phiếu: trả lại số đã phân bổ cho các hóa đơn. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void cancel(CashVoucher v) {
        if ("CANCELLED".equals(v.getStatus())) {
            return;
        }
        v.setStatus("CANCELLED");
        for (Map<String, Object> row : jdbc.queryForList(
                "select invoice_id, amount from voucher_allocations where voucher_id = ?", v.getId())) {
            invoices.findForUpdate((UUID) row.get("invoice_id"))
                    .ifPresent(inv -> inv.setPaid(inv.getPaid().subtract((BigDecimal) row.get("amount"))));
        }
    }

    public static CashVoucher newVoucher(String code, String type, String fund, String category, BigDecimal amount) {
        var v = new CashVoucher();
        v.setId(UUID.randomUUID());
        v.setCode(code);
        v.setVoucherType(type);
        v.setFund(fund);
        v.setCategory(category);
        v.setAmount(amount);
        return v;
    }
}
