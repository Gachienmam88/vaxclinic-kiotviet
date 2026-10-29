package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.common.SalesRules;
import com.vaxclinic.sales.delivery.ShipmentDtos.ReturnOptions;
import com.vaxclinic.sales.delivery.ShipmentDtos.StatusResult;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Đổi trạng thái vận đơn (KHÔNG mở transaction — Đã chuyển hoàn gọi kho qua đường trả hàng):
 * Đã hủy (chỉ khi chưa lấy hàng) → chỉ hủy vận đơn, hóa đơn vẫn Hoàn thành (khách còn nợ phần chưa trả, tạo vận đơn khác được);
 * Chuyển hoàn → chỉ đổi trạng thái (hàng đang trên đường về); Đã chuyển hoàn lần đầu → phiếu trả hàng toàn bộ hàng còn lại
 * (hoàn tiền / giữ công nợ theo refundMethod) + phí cửa hàng chịu ghi sổ đối tác; còn lại ghi qua writer.
 */
@Service
public class ShipmentStatusService {

    private final ShipmentRepository shipments;
    private final ShipmentStatusWriter writer;
    private final ShipmentReturnService returns;
    private final SalesRules rules;
    private final AuditLogger audit;

    public ShipmentStatusService(ShipmentRepository shipments, ShipmentStatusWriter writer, ShipmentReturnService returns,
                                 SalesRules rules, AuditLogger audit) {
        this.shipments = shipments;
        this.writer = writer;
        this.returns = returns;
        this.rules = rules;
        this.audit = audit;
    }

    /** Cập nhật nhiều vận đơn: lỗi ở 1 vận đơn không chặn các vận đơn khác. Phí nhập tay chỉ áp dụng khi chọn 1 vận đơn. */
    public List<StatusResult> changeAll(List<UUID> ids, String to, String note, ReturnOptions opts, Actor actor) {
        List<UUID> distinct = ids.stream().distinct().toList();
        if (distinct.size() > 1 && (opts.shippingFee() != null || opts.returnFee() != null)) {
            throw BusinessException.badRequest("FEE_PER_SHIPMENT", "Phí giao hàng / phí chuyển hoàn chỉ nhập được khi cập nhật từng vận đơn");
        }
        var out = new ArrayList<StatusResult>();
        for (UUID id : distinct) {
            try {
                out.add(change(id, to, note, opts, actor));
            } catch (BusinessException e) {
                out.add(new StatusResult(id, codeOf(id), false, null, e.getMessage()));
            }
        }
        return out;
    }

    public StatusResult change(UUID id, String to, String note, ReturnOptions opts, Actor actor) {
        var rows = shipments.find(id);
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
        rules.checkNotLocked(branchId, Instant.now()); // công nợ / phiếu trả / phí phát sinh lúc này
        UUID invoiceId = (UUID) s.get("invoice_id");
        UUID returnId = null;
        if (ShipmentStatus.RETURNED.equals(to) && s.get("return_id") == null) {
            returns.validate(code, invoiceId, opts);
            returnId = returns.create(id, code, invoiceId, opts, actor);
        }
        writer.apply(id, from, to, returnId, opts, Actor.blankToNull(note), actor);
        actor.audit(audit, branchId, "Vận đơn", "Cập nhật trạng thái", code, code + ": " + ShipmentStatus.label(from) + " → "
                + ShipmentStatus.label(to) + detail(to, opts) + (Actor.blankToNull(note) == null ? "" : " (" + note.trim() + ")"));
        return new StatusResult(id, code, true, to, null);
    }

    private static String detail(String to, ReturnOptions opts) {
        if (ShipmentStatus.CANCELLED.equals(to)) {
            return ", hóa đơn giữ nguyên";
        }
        if (!ShipmentStatus.RETURNED.equals(to) || opts.refundMethod() == null) {
            return "";
        }
        return ", hoàn tiền: " + switch (opts.refundMethod()) {
            case "TRANSFER" -> "chuyển khoản";
            case "CREDIT" -> "giữ làm công nợ";
            default -> "tiền mặt";
        } + (opts.shippingFee() == null ? "" : ", phí giao hàng " + Actor.money(opts.shippingFee()))
                + (opts.returnFee() == null ? "" : ", phí chuyển hoàn " + Actor.money(opts.returnFee()));
    }

    private String codeOf(UUID id) {
        return shipments.codeOf(id);
    }
}
