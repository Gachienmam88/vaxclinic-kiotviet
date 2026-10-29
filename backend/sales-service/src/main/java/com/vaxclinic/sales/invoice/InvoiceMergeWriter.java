package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.debt.DebtLedger;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Phần ghi DB của "Gộp đơn" — 1 transaction: tạo hóa đơn gộp (dòng hàng + giá vốn + lô giữ nguyên), chuyển phiếu thu và
 * phân bổ sang hóa đơn mới (sổ quỹ không đổi), hóa đơn gốc → Đã hủy, sổ công nợ: hủy bán từng hóa đơn gốc + bán hóa đơn gộp
 * (tổng nợ khách không đổi, các dòng thanh toán giữ nguyên).
 */
@Component
public class InvoiceMergeWriter {

    private final InvoiceRepository invoices;
    private final InvoiceMergeRepository merges;
    private final DebtLedger debt;

    public InvoiceMergeWriter(InvoiceRepository invoices, InvoiceMergeRepository merges, DebtLedger debt) {
        this.invoices = invoices;
        this.merges = merges;
        this.debt = debt;
    }

    /** originals: đã sắp theo thời gian bán; lineIds: id dòng mới theo đúng thứ tự dòng của originals. */
    @Transactional
    public Invoice persist(UUID id, String code, List<Invoice> originals, List<UUID> lineIds, Actor actor) {
        var existing = invoices.findById(id);
        if (existing.isPresent()) {
            return existing.get();
        }
        // Khóa theo id cố định (tránh deadlock khi 2 lần gộp chạy song song), rồi giữ thứ tự thời gian bán
        var locked = new ArrayList<Invoice>();
        originals.stream().map(Invoice::getId).sorted().forEach(x -> locked.add(invoices.findForUpdate(x).orElseThrow()));
        locked.sort(Comparator.comparing(Invoice::getSoldAt).thenComparing(Invoice::getCode));
        for (Invoice o : locked) {
            if (!"COMPLETED".equals(o.getStatus())) {
                throw BusinessException.conflict("INVOICE_ALREADY_CANCELLED", "Hóa đơn " + o.getCode() + " đã bị hủy hoặc đã gộp");
            }
        }
        Invoice first = locked.get(0);
        Invoice last = locked.get(locked.size() - 1);
        List<UUID> fromIds = locked.stream().map(Invoice::getId).toList();
        // Phiếu thu chính (TT{mã}) đầu tiên → phiếu chính của hóa đơn gộp; phương thức thanh toán theo hóa đơn sở hữu phiếu đó
        UUID mainVoucher = null;
        String mainMethod = first.getPaymentMethod();
        for (Invoice o : locked) {
            mainVoucher = merges.mainVoucher(o.getId());
            if (mainVoucher != null) {
                mainMethod = o.getPaymentMethod();
                break;
            }
        }

        var inv = new Invoice();
        inv.setId(id);
        inv.setCode(code);
        inv.setBranchId(first.getBranchId());
        inv.setCustomerId(first.getCustomerId());
        inv.setCustomerName(first.getCustomerName());
        inv.setSellerId(last.getSellerId());
        inv.setSellerName(last.getSellerName());
        inv.setCreatedBy(actor.id());
        inv.setCreatedByName(actor.name());
        inv.setSoldAt(last.getSoldAt()); // doanh thu vẫn nằm trong kỳ của hóa đơn gốc mới nhất
        inv.setSaleMode(first.getSaleMode());
        inv.setSubtotal(sum(locked, Invoice::getSubtotal));
        inv.setDiscount(sum(locked, Invoice::getDiscount));
        inv.setTotal(sum(locked, Invoice::getTotal));
        inv.setPaid(sum(locked, Invoice::getPaid));
        inv.setPaymentMethod(mainMethod);
        inv.setNote("Gộp từ hóa đơn " + String.join(", ", locked.stream().map(Invoice::getCode).toList()));
        inv.setStockDocId(id);
        inv.setPriceBookId(same(locked, Invoice::getPriceBookId));
        inv.setPriceBookName(inv.getPriceBookId() == null ? null : first.getPriceBookName());
        inv.setSalesChannel(Objects.requireNonNullElse(same(locked, Invoice::getSalesChannel), first.getSalesChannel()));
        var sourceLines = new ArrayList<UUID>();
        for (Invoice o : locked) {
            for (InvoiceLine l : o.getLines()) {
                var line = new InvoiceLine();
                line.setId(lineIds.get(sourceLines.size()));
                line.setInvoice(inv);
                line.setLineNo(sourceLines.size() + 1);
                line.setProductId(l.getProductId());
                line.setUnitId(l.getUnitId());
                line.setProductCode(l.getProductCode());
                line.setProductName(l.getProductName());
                line.setUnitName(l.getUnitName());
                line.setQuantity(l.getQuantity());
                line.setUnitPrice(l.getUnitPrice());
                line.setDiscount(l.getDiscount());
                line.setCost(l.getCost());
                line.setLots(l.getLots());
                line.setNote(l.getNote());
                line.setTaxCode(l.getTaxCode());
                inv.getLines().add(line);
                sourceLines.add(l.getId());
            }
        }
        if (sourceLines.size() != lineIds.size()) {
            throw BusinessException.conflict("INVOICE_CHANGED", "Hóa đơn gốc vừa được sửa, vui lòng mở lại Gộp đơn");
        }
        Instant now = Instant.now();
        for (Invoice o : locked) {
            o.setStatus("CANCELLED");
            o.setCancelledAt(now);
            o.setPaid(BigDecimal.ZERO); // phân bổ chuyển hết sang hóa đơn gộp
        }
        invoices.saveAndFlush(inv);
        for (int i = 0; i < sourceLines.size(); i++) {
            merges.copyLineLots(sourceLines.get(i), lineIds.get(i));
        }
        merges.moveVouchers(fromIds, id, mainVoucher);
        merges.markMerged(fromIds, id);
        if (inv.getCustomerId() != null) {
            for (Invoice o : locked) {
                debt.post(o.getCustomerId(), DebtLedger.DocType.SALE_CANCEL, o.getId(), o.getCode(), o.getTotal().negate(),
                        "Gộp vào hóa đơn " + code, now);
            }
            debt.post(inv.getCustomerId(), DebtLedger.DocType.SALE, id, code, inv.getTotal(), inv.getNote(), now);
        }
        return inv;
    }

    private static BigDecimal sum(List<Invoice> list, java.util.function.Function<Invoice, BigDecimal> f) {
        return list.stream().map(f).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Giá trị chung của mọi hóa đơn gốc; khác nhau → null. */
    private static <T> T same(List<Invoice> list, java.util.function.Function<Invoice, T> f) {
        T v = f.apply(list.get(0));
        return list.stream().allMatch(o -> Objects.equals(f.apply(o), v)) ? v : null;
    }
}
