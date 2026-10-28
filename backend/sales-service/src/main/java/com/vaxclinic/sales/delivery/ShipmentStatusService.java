package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.common.SalesRules;
import com.vaxclinic.sales.delivery.ShipmentDtos.StatusResult;
import com.vaxclinic.sales.invoice.Invoice;
import com.vaxclinic.sales.invoice.InvoiceRepository;
import com.vaxclinic.sales.invoice.InvoiceService;
import com.vaxclinic.sales.salesreturn.SalesReturnDtos;
import com.vaxclinic.sales.salesreturn.SalesReturnService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Đổi trạng thái vận đơn (KHÔNG mở transaction — chuyển hoàn gọi kho qua đường trả hàng):
 * Đã hủy → hủy hóa đơn (hàng nhập lại kho, chỉ khi chưa lấy hàng); Chuyển hoàn / Đã chuyển hoàn lần đầu → phiếu trả hàng
 * toàn bộ hàng còn lại (id suy ra từ vận đơn → gọi lại không tạo trùng), hoàn khách số đã trả trước; còn lại ghi qua writer.
 */
@Service
public class ShipmentStatusService {

    private final JdbcTemplate jdbc;
    private final ShipmentStatusWriter writer;
    private final InvoiceService invoices;
    private final InvoiceRepository invoiceRepo;
    private final SalesReturnService returns;
    private final SalesRules rules;
    private final AuditLogger audit;

    public ShipmentStatusService(JdbcTemplate jdbc, ShipmentStatusWriter writer, InvoiceService invoices,
                                 InvoiceRepository invoiceRepo, SalesReturnService returns, SalesRules rules, AuditLogger audit) {
        this.jdbc = jdbc;
        this.writer = writer;
        this.invoices = invoices;
        this.invoiceRepo = invoiceRepo;
        this.returns = returns;
        this.rules = rules;
        this.audit = audit;
    }

    /** Cập nhật nhiều vận đơn: lỗi ở 1 vận đơn không chặn các vận đơn khác. */
    public List<StatusResult> changeAll(List<UUID> ids, String to, String note, Actor actor) {
        var out = new ArrayList<StatusResult>();
        for (UUID id : ids.stream().distinct().toList()) {
            try {
                out.add(change(id, to, note, actor));
            } catch (BusinessException e) {
                out.add(new StatusResult(id, codeOf(id), false, null, e.getMessage()));
            }
        }
        return out;
    }

    public StatusResult change(UUID id, String to, String note, Actor actor) {
        var rows = jdbc.queryForList("select * from shipments where id = ?", id);
        if (rows.isEmpty()) {
            throw BusinessException.notFound("SHIPMENT_NOT_FOUND", "Không tìm thấy vận đơn");
        }
        Map<String, Object> s = rows.get(0);
        String from = (String) s.get("status");
        String code = (String) s.get("code");
        UUID branchId = (UUID) s.get("branch_id");
        actor.checkBranch(branchId);
        if (from.equals(to)) {
            return new StatusResult(id, code, true, to, "Vận đơn đã ở trạng thái " + ShipmentStatus.label(to));
        }
        if (!ShipmentStatus.canMove(from, to)) {
            throw BusinessException.badRequest("SHIPMENT_STATUS_INVALID", code + ": không chuyển được từ "
                    + ShipmentStatus.label(from) + " sang " + ShipmentStatus.label(to));
        }
        rules.checkNotLocked(branchId, Instant.now()); // công nợ / phiếu trả phát sinh lúc này
        UUID invoiceId = (UUID) s.get("invoice_id");
        if (ShipmentStatus.CANCELLED.equals(to)) {
            invoices.cancel(invoiceId, actor); // hủy hóa đơn → vận đơn chuyển Đã hủy trong cùng transaction
        } else {
            UUID returnId = ShipmentStatus.returning(to) && s.get("return_id") == null ? createReturn(id, code, invoiceId, actor) : null;
            writer.apply(id, from, to, returnId, Actor.blankToNull(note), actor);
        }
        actor.audit(audit, branchId, "Vận đơn", "Cập nhật trạng thái", code, code + ": " + ShipmentStatus.label(from) + " → "
                + ShipmentStatus.label(to) + (Actor.blankToNull(note) == null ? "" : " (" + note.trim() + ")"));
        return new StatusResult(id, code, true, to, null);
    }

    /** Phiếu trả hàng cho toàn bộ hàng còn lại của hóa đơn; tiền khách đã trả trước được hoàn (tiền mặt). */
    private UUID createReturn(UUID shipmentId, String code, UUID invoiceId, Actor actor) {
        Invoice inv = invoiceRepo.findWithLines(invoiceId).orElseThrow();
        var lines = new ArrayList<SalesReturnDtos.LineInput>();
        BigDecimal subtotal = BigDecimal.ZERO;
        for (var l : inv.getLines()) {
            BigDecimal left = l.getQuantity().subtract(jdbc.queryForObject("""
                    select coalesce(sum(rl.quantity), 0) from sales_return_lines rl join sales_returns r on r.id = rl.return_id
                    where rl.invoice_line_id = ? and r.status = 'COMPLETED'""", BigDecimal.class, l.getId()));
            if (left.signum() > 0) {
                lines.add(new SalesReturnDtos.LineInput(l.getId(), left, null));
                subtotal = subtotal.add(left.multiply(l.getUnitPrice().subtract(l.getDiscount())).setScale(0, RoundingMode.HALF_UP));
            }
        }
        if (lines.isEmpty()) {
            return null;
        }
        BigDecimal discount = inv.getDiscount().min(subtotal);
        BigDecimal refund = inv.getPaid().min(subtotal.subtract(discount)).max(BigDecimal.ZERO);
        UUID returnId = UUID.nameUUIDFromBytes(("shipment-return:" + shipmentId).getBytes(StandardCharsets.UTF_8));
        returns.create(new SalesReturnDtos.ReturnRequest(returnId, invoiceId, Instant.now(), lines, discount, BigDecimal.ZERO,
                refund, "CASH", "Chuyển hoàn vận đơn " + code), actor);
        return returnId;
    }

    private String codeOf(UUID id) {
        return jdbc.query("select code from shipments where id = ?", rs -> rs.next() ? rs.getString(1) : null, id);
    }
}
