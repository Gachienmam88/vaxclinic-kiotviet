package com.vaxclinic.product.purchase;

import com.vaxclinic.product.product.Product;
import com.vaxclinic.product.product.ProductRepository;
import com.vaxclinic.product.product.ProductUnit;
import com.vaxclinic.product.purchase.PurchaseDtos.LineResponse;
import com.vaxclinic.product.purchase.PurchaseDtos.ReceiptResponse;
import com.vaxclinic.product.purchase.PurchaseDtos.ReturnLineResponse;
import com.vaxclinic.product.purchase.PurchaseDtos.ReturnResponse;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** Chuyển entity phiếu nhập / trả hàng nhập → response kèm mã, tên hàng, tên đơn vị, tên NCC. */
@Component
@Transactional(readOnly = true)
public class PurchaseDetailMapper {

    private final ProductRepository products;
    private final SupplierRepository suppliers;
    private final PurchaseReceiptRepository receipts;
    private final PurchaseReturnRepository returns;

    public PurchaseDetailMapper(ProductRepository products, SupplierRepository suppliers,
                                PurchaseReceiptRepository receipts, PurchaseReturnRepository returns) {
        this.products = products;
        this.suppliers = suppliers;
        this.receipts = receipts;
        this.returns = returns;
    }

    public ReceiptResponse receipt(UUID id) {
        PurchaseReceipt r = receipts.findById(id).orElseThrow();
        Supplier s = r.getSupplierId() == null ? null : suppliers.findById(r.getSupplierId()).orElse(null);
        Map<UUID, Product> cache = new HashMap<>();
        var totals = new PurchaseMath.Totals(r.getSubtotal(), r.getDiscount(), r.getVatAmount(), r.getTotal());
        var lines = r.getLines().stream().map(l -> {
            Product p = cache.computeIfAbsent(l.getProductId(), k -> products.findById(k).orElseThrow());
            ProductUnit u = unit(p, l.getUnitId());
            // Giá nhập có VAT theo VAT% của dòng (VAT nhập tay: chia đều theo tiền hàng)
            BigDecimal withVat = PurchaseMath.priceWithVat(l.getUnitPrice(), l.getDiscount(),
                    PurchaseMath.vatRatio(r.getVatMode(), l.getVatRate(), totals));
            return new LineResponse(l.getId(), l.getLineNo(), p.getId(), u.getCode(), p.getName(), u.getId(),
                    u.getUnitName(), l.getConversionRate(), l.getQuantity(), l.getUnitPrice(), l.getDiscount(), withVat,
                    PurchaseMath.money(PurchaseMath.lineAmount(l.getQuantity(), l.getUnitPrice(), l.getDiscount())),
                    l.getLotNumber(), l.getExpiryDate(), l.getVatRate(), l.getNote());
        }).toList();
        return new ReceiptResponse(r.getId(), r.getCode(), r.getBranchId(), r.getStatus().name(), r.getReceivedAt(),
                r.getSupplierId(), s == null ? null : s.getCode(), s == null ? null : s.getName(), r.getCreatedBy(),
                r.getCreatedByName(), r.getReceiverId(), r.getReceiverName(), r.getInputInvoiceNo(), r.getVatRate(),
                r.getSubtotal(), r.getDiscount(), r.getVatAmount(), r.getTotal(), r.getPaidAmount(),
                r.getPaymentMethod(), r.getNote(), r.getCompletedAt(), r.getCancelledAt(), lines, r.getVatMode(),
                r.isPaymentPosted(), returns.findByReceiptIdOrderByReturnedAtDesc(r.getId()).stream()
                .map(x -> new PurchaseDtos.ReturnRef(x.getId(), x.getCode(), x.getStatus().name(), x.getReturnedAt(), x.getTotal()))
                .toList());
    }

    public ReturnResponse purchaseReturn(UUID id) {
        PurchaseReturn r = returns.findById(id).orElseThrow();
        Supplier s = r.getSupplierId() == null ? null : suppliers.findById(r.getSupplierId()).orElse(null);
        String receiptCode = r.getReceiptId() == null ? null
                : receipts.findById(r.getReceiptId()).map(PurchaseReceipt::getCode).orElse(null);
        Map<UUID, Product> cache = new HashMap<>();
        var totals = new PurchaseMath.Totals(r.getSubtotal(), r.getDiscount(), r.getVatAmount(), r.getTotal());
        var lines = r.getLines().stream().map(l -> {
            Product p = cache.computeIfAbsent(l.getProductId(), k -> products.findById(k).orElseThrow());
            ProductUnit u = unit(p, l.getUnitId());
            return new ReturnLineResponse(l.getId(), l.getLineNo(), p.getId(), u.getCode(), p.getName(), u.getId(),
                    u.getUnitName(), l.getConversionRate(), l.getQuantity(), l.getUnitPrice(),
                    PurchaseMath.money(l.getQuantity().multiply(l.getUnitPrice())), l.getLotNumber(), l.getVatRate(),
                    l.getNote(), PurchaseMath.priceWithVat(l.getUnitPrice(), BigDecimal.ZERO,
                    PurchaseMath.vatRatio(r.getVatMode(), l.getVatRate(), totals)));
        }).toList();
        return new ReturnResponse(r.getId(), r.getCode(), r.getBranchId(), r.getStatus().name(), r.getReturnedAt(),
                r.getSupplierId(), s == null ? null : s.getCode(), s == null ? null : s.getName(), r.getReceiptId(),
                receiptCode, r.getCreatedByName(), r.getReturnerId(), r.getReturnerName(), r.getSubtotal(),
                r.getDiscount(), r.getVatRate(), r.getVatAmount(), r.getTotal(), r.getRefundAmount(), r.getNote(), lines,
                r.getVatMode(), r.getPaymentMethod());
    }

    /** Đơn vị có thể đã bị xóa khỏi hàng hóa sau khi lập phiếu → vẫn hiển thị được. */
    private static ProductUnit unit(Product p, UUID unitId) {
        return p.getUnits().stream().filter(u -> u.getId().equals(unitId)).findFirst().orElseGet(() -> {
            var ghost = new ProductUnit();
            ghost.setId(unitId);
            ghost.setCode("—");
            ghost.setUnitName("(đơn vị đã xóa)");
            return ghost;
        });
    }
}
