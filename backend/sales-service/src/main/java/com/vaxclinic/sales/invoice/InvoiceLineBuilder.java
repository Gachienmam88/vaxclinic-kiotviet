package com.vaxclinic.sales.invoice;

import com.vaxclinic.sales.invoice.InvoiceDtos.LineInput;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Dựng dòng hóa đơn từ dữ liệu màn bán hàng + kết quả xuất kho (giá vốn, lô FEFO) — dùng chung cho bán mới và sửa hóa đơn.
 * Lô đã xuất của từng dòng lưu vào invoice_line_lots để trả hàng hoàn đúng lô.
 */
@Component
public class InvoiceLineBuilder {

    private final InvoiceLineLotRepository lineLots;

    public InvoiceLineBuilder(InvoiceLineLotRepository lineLots) {
        this.lineLots = lineLots;
    }

    /** reduced[i]: dòng i được giảm thuế (server xác định — InvoiceMath.Totals.reducedLines). */
    public void addLines(Invoice inv, List<LineInput> inputs, List<UUID> lineIds, ProductStockClient.Result stockResult,
                         List<Boolean> reduced) {
        var byLine = stockResult.lines().stream().collect(Collectors.toMap(ProductStockClient.LineResult::lineId, r -> r));
        for (int i = 0; i < inputs.size(); i++) {
            var in = inputs.get(i);
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
            line.setLots(sr == null ? null : sr.allocations().stream().filter(a -> a.lotNumber() != null)
                    .map(a -> a.lotNumber() + ":" + a.baseQuantity().setScale(0, RoundingMode.DOWN).toPlainString())
                    .collect(Collectors.joining(", ")));
            line.setNote(in.note());
            line.setTaxCode(in.taxCode());
            line.setTaxReduced(i < reduced.size() && Boolean.TRUE.equals(reduced.get(i)));
            inv.getLines().add(line);
        }
    }

    /** Gọi SAU khi các dòng đã được flush xuống DB (khóa ngoại line_id). */
    public void saveLots(ProductStockClient.Result stockResult) {
        for (var r : stockResult.lines()) {
            for (var a : r.allocations()) {
                lineLots.add(r.lineId(), a.lotNumber() == null ? "" : a.lotNumber(), a.baseQuantity());
            }
        }
    }
}
