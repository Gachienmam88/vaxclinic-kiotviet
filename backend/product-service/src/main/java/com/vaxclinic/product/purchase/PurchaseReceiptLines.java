package com.vaxclinic.product.purchase;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.product.Product;
import com.vaxclinic.product.purchase.PurchaseDtos.ReceiptLineInput;
import com.vaxclinic.product.purchase.PurchaseDtos.ReceiptRequest;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Dòng + tiền của phiếu nhập dùng chung cho Lưu tạm / Hoàn thành ({@link PurchaseReceiptService}) và sửa phiếu đã nhập
 * ({@link PurchaseReceiptAdjustService}): VAT theo dòng hoặc nhập tay, tổng tiền, giá vốn từng dòng.
 */
@Component
public class PurchaseReceiptLines {

    private final PurchaseLineSupport support;

    public PurchaseReceiptLines(PurchaseLineSupport support) {
        this.support = support;
    }

    /** Thay toàn bộ dòng của phiếu tạm theo request; strict (Hoàn thành) = bắt buộc có dòng + lô/HSD với hàng theo lô. */
    public void replaceLines(PurchaseReceipt r, ReceiptRequest req, boolean strict) {
        List<ReceiptLineInput> inputs = req.lines() == null ? List.of() : req.lines();
        if (strict && inputs.isEmpty()) {
            throw BusinessException.badRequest("RECEIPT_EMPTY", "Phiếu nhập chưa có hàng hóa");
        }
        Map<UUID, Product> cache = support.newCache();
        r.getLines().clear();
        int no = 1;
        for (var in : inputs) {
            Product p = support.product(cache, in.productId());
            var unit = support.unit(p, in.unitId());
            String lot = PurchaseLineSupport.blankToNull(in.lotNumber());
            if (strict && p.isLotManaged() && (lot == null || in.expiryDate() == null)) {
                throw BusinessException.badRequest("LOT_REQUIRED", p.getName() + " quản lý theo lô: nhập số lô và hạn sử dụng");
            }
            var line = new PurchaseReceiptLine();
            line.setId(UUID.randomUUID());
            line.setReceipt(r);
            line.setLineNo(no++);
            line.setProductId(p.getId());
            line.setUnitId(unit.getId());
            line.setConversionRate(unit.getConversionRate());
            line.setLotNumber(p.isLotManaged() ? lot : null);
            line.setExpiryDate(p.isLotManaged() ? in.expiryDate() : null);
            setValues(line, in, req, p.getName());
            r.getLines().add(line);
        }
    }

    /** SL, đơn giá, giảm giá, VAT%, ghi chú của 1 dòng (giảm giá / đv không được lớn hơn đơn giá). */
    public void setValues(PurchaseReceiptLine line, ReceiptLineInput in, ReceiptRequest req, String productName) {
        BigDecimal disc = in.discount() == null ? BigDecimal.ZERO : in.discount();
        if (disc.compareTo(in.unitPrice()) > 0) {
            throw BusinessException.badRequest("DISCOUNT_TOO_LARGE", productName + ": giảm giá lớn hơn đơn giá");
        }
        line.setQuantity(in.quantity());
        line.setUnitPrice(in.unitPrice());
        line.setDiscount(disc);
        line.setVatRate(PurchaseMath.lineRate(req.vatMode(), req.vatRate(), in.vatRate()));
        line.setNote(PurchaseLineSupport.blankToNull(in.note()));
    }

    /** Tính lại tiền hàng / giảm giá / VAT / tổng cộng + chế độ VAT + mức VAT chung của phiếu từ các dòng hiện tại. */
    public void applyTotals(PurchaseReceipt r, ReceiptRequest req) {
        String mode = PurchaseMath.mode(req.vatMode());
        var amounts = new ArrayList<PurchaseMath.LineAmount>();
        var rates = new ArrayList<BigDecimal>();
        for (var l : r.getLines()) {
            amounts.add(new PurchaseMath.LineAmount(PurchaseMath.lineAmount(l.getQuantity(), l.getUnitPrice(), l.getDiscount()),
                    l.getVatRate()));
            rates.add(l.getVatRate());
        }
        var t = PurchaseMath.totals(amounts, req.discount() == null ? BigDecimal.ZERO : req.discount(),
                PurchaseMath.MODE_MANUAL.equals(mode), req.vatAmount());
        r.setVatMode(mode);
        r.setVatRate(PurchaseMath.commonRate(mode, rates, req.vatRate()));
        r.setSubtotal(t.subtotal());
        r.setDiscount(t.discount());
        r.setVatAmount(t.vatAmount());
        r.setTotal(t.total());
    }

    /** Giá vốn / đơn vị cơ bản của dòng theo tiền hiện tại của phiếu (gồm VAT, phân bổ giảm giá phiếu). */
    public static BigDecimal lineCost(PurchaseReceipt r, PurchaseReceiptLine line) {
        var totals = new PurchaseMath.Totals(r.getSubtotal(), r.getDiscount(), r.getVatAmount(), r.getTotal());
        return PurchaseMath.baseUnitCostWithRatio(line.getUnitPrice(), line.getDiscount(), line.getConversionRate(), totals,
                PurchaseMath.vatRatio(r.getVatMode(), line.getVatRate(), totals));
    }
}
