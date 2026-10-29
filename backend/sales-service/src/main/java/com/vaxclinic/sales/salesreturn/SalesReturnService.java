package com.vaxclinic.sales.salesreturn;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.common.SalesRules;
import com.vaxclinic.sales.invoice.Invoice;
import com.vaxclinic.sales.invoice.InvoiceLine;
import com.vaxclinic.sales.invoice.InvoiceLineLotRepository;
import com.vaxclinic.sales.invoice.InvoiceRepository;
import com.vaxclinic.sales.invoice.ProductStockClient;
import com.vaxclinic.sales.salesreturn.SalesReturnDtos.ReturnRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Khách trả hàng theo hóa đơn (không mở transaction — gọi HTTP sang kho):
 * kiểm tra số lượng còn được trả → chọn lô (chính các lô đã bán cho khách, trừ phần đã trả) → kho nhập lại (SALE_RETURN,
 * idempotent theo id phiếu) → SalesReturnWriter ghi phiếu + phiếu chi + công nợ trong 1 transaction.
 */
@Service
public class SalesReturnService {

    /** 1 dòng trả đã tính xong: lô nhập lại theo đơn vị cơ bản. */
    public record PlannedLine(UUID lineId, InvoiceLine invoiceLine, BigDecimal quantity, BigDecimal unitPrice,
                              Map<String, BigDecimal> lots) {
    }

    private final InvoiceRepository invoices;
    private final SalesReturnRepository returns;
    private final InvoiceLineLotRepository lineLots;
    private final ProductStockClient stock;
    private final SalesReturnWriter writer;

    private final SalesRules rules;
    private final QuickReturnService quick;

    public SalesReturnService(InvoiceRepository invoices, SalesReturnRepository returns, InvoiceLineLotRepository lineLots,
                              ProductStockClient stock, SalesReturnWriter writer, SalesRules rules, QuickReturnService quick) {
        this.quick = quick;
        this.invoices = invoices;
        this.returns = returns;
        this.lineLots = lineLots;
        this.stock = stock;
        this.writer = writer;
        this.rules = rules;
    }

    /** Trả theo hóa đơn (chuyển hoàn vận đơn gọi trực tiếp). */
    public UUID create(ReturnRequest req, Actor actor) {
        return create(req, actor, null);
    }

    /** bearerToken: JWT người thao tác — "Trả nhanh" (invoiceId null) dùng để tra hàng hóa ở product-service. */
    public UUID create(ReturnRequest req, Actor actor, String bearerToken) {
        if (writer.exists(req.id())) {
            return req.id();
        }
        if (req.invoiceId() == null) {
            return quick.create(req, actor, bearerToken);
        }
        Invoice inv = invoices.findWithLines(req.invoiceId())
                .orElseThrow(() -> BusinessException.notFound("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
        if (!"COMPLETED".equals(inv.getStatus())) {
            throw BusinessException.badRequest("INVOICE_NOT_RETURNABLE", "Hóa đơn đã hủy, không trả hàng được");
        }
        actor.checkBranch(inv.getBranchId());
        java.time.Instant returnedAt = req.returnedAt() == null ? java.time.Instant.now() : req.returnedAt();
        rules.checkNotLocked(inv.getBranchId(), returnedAt);
        rules.checkReturnWindow(inv.getSoldAt(), returnedAt);
        var planned = new ArrayList<PlannedLine>();
        for (int i = 0; i < req.lines().size(); i++) {
            var in = req.lines().get(i);
            InvoiceLine line = inv.getLines().stream().filter(l -> l.getId().equals(in.invoiceLineId())).findFirst()
                    .orElseThrow(() -> BusinessException.badRequest("LINE_NOT_FOUND", "Dòng hàng không thuộc hóa đơn"));
            BigDecimal left = line.getQuantity().subtract(returnedQty(line.getId()));
            if (in.quantity().compareTo(left) > 0) {
                throw BusinessException.badRequest("RETURN_EXCEEDS_SOLD",
                        line.getProductName() + ": chỉ còn trả được " + left.stripTrailingZeros().toPlainString());
            }
            BigDecimal price = in.unitPrice() != null ? in.unitPrice() : line.getUnitPrice().subtract(line.getDiscount());
            UUID lineId = UUID.nameUUIDFromBytes((req.id() + ":" + i).getBytes(StandardCharsets.UTF_8));
            planned.add(new PlannedLine(lineId, line, in.quantity(), price, pickLots(line, in.quantity())));
        }
        BigDecimal subtotal = planned.stream().map(p -> p.quantity().multiply(p.unitPrice()).setScale(0, RoundingMode.HALF_UP))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discount = money(req.discount()).min(subtotal);
        BigDecimal fee = money(req.fee()).min(subtotal.subtract(discount));
        BigDecimal total = subtotal.subtract(discount).subtract(fee);
        BigDecimal refund = req.refundAmount() == null ? total : money(req.refundAmount()).min(total);
        // Khách lẻ: trả đủ, trừ phần hóa đơn chưa thu (bán giao hàng chuyển hoàn: tiền thu hộ chưa thu được)
        BigDecimal unpaid = inv.getTotal().subtract(inv.getPaid()).max(BigDecimal.ZERO);
        if (inv.getCustomerId() == null && refund.compareTo(total.subtract(unpaid)) < 0) {
            throw BusinessException.badRequest("WALK_IN_REFUND", "Khách lẻ: phải trả đủ tiền cho khách");
        }
        String code = "TH%06d".formatted(returns.nextCodeNumber());
        var stockLines = new ArrayList<ProductStockClient.Line>();
        planned.forEach(p -> p.lots().forEach((lot, qty) -> stockLines.add(new ProductStockClient.Line(p.lineId(),
                p.invoiceLine().getProductId(), null, null, lot.isEmpty() ? null : lot, qty))));
        stock.apply(new ProductStockClient.Request(req.id(), "SALE_RETURN", code, inv.getBranchId(), inv.getCustomerName(),
                actor.id(), null, stockLines));
        writer.persist(req, inv, code, planned, subtotal, discount, fee, total, refund, actor);
        return req.id();
    }

    public void cancel(UUID id, Actor actor) {
        var r = writer.find(id);
        if ("CANCELLED".equals(r.get("status"))) {
            return;
        }
        actor.checkBranch((UUID) r.get("branch_id"));
        rules.checkNotLocked((UUID) r.get("branch_id"), ((java.sql.Timestamp) r.get("returned_at")).toInstant());
        stock.apply(new ProductStockClient.Request(id, "SALE_RETURN_CANCEL", (String) r.get("code"), (UUID) r.get("branch_id"),
                (String) r.get("customer_name"), actor.id(), null, List.of()));
        writer.markCancelled(id);
    }

    private BigDecimal returnedQty(UUID invoiceLineId) {
        return returns.returnedQuantity(invoiceLineId);
    }

    /** Lô nhập lại = các lô đã xuất cho dòng này trừ phần đã trả, theo tỷ lệ quy đổi đơn vị của dòng. */
    private Map<String, BigDecimal> pickLots(InvoiceLine line, BigDecimal quantity) {
        Map<String, BigDecimal> available = lineLots.returnableLots(line.getId());
        BigDecimal soldBase = lineLots.soldBaseQuantity(line.getId());
        if (soldBase.signum() == 0) {
            throw BusinessException.badRequest("LINE_LOTS_MISSING", line.getProductName() + ": không có dữ liệu xuất kho để trả");
        }
        BigDecimal rate = soldBase.divide(line.getQuantity(), 4, RoundingMode.HALF_UP);
        BigDecimal need = quantity.multiply(rate).setScale(3, RoundingMode.HALF_UP);
        var out = new LinkedHashMap<String, BigDecimal>();
        for (var e : available.entrySet()) {
            if (need.signum() <= 0) {
                break;
            }
            BigDecimal take = need.min(e.getValue());
            if (take.signum() > 0) {
                out.put(e.getKey(), take);
                need = need.subtract(take);
            }
        }
        if (need.signum() > 0) {
            throw BusinessException.badRequest("RETURN_EXCEEDS_SOLD", line.getProductName() + ": vượt số lượng đã bán theo lô");
        }
        return out;
    }

    private static BigDecimal money(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v.setScale(0, RoundingMode.HALF_UP);
    }
}
