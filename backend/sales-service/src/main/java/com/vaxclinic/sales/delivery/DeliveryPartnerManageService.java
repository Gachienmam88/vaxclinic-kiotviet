package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.LedgerRow;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.PartnerListResponse;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.PartnerRequest;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.PartnerRow;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.ReconcileRow;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.SettlementRow;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Đối tác giao hàng cho màn hình: danh sách / chi tiết / sổ công nợ / lịch sử thanh toán / vận đơn chờ đối soát
 * ({@link DeliveryPartnerQuery}), thêm / sửa / xóa ({@link DeliveryPartnerService}) kèm ghi lịch sử thao tác sau commit.
 */
@Service
public class DeliveryPartnerManageService {

    private static final String FEATURE = "Đối tác giao hàng";

    private final DeliveryPartnerService service;
    private final DeliveryPartnerQuery query;
    private final AuditLogger audit;

    public DeliveryPartnerManageService(DeliveryPartnerService service, DeliveryPartnerQuery query, AuditLogger audit) {
        this.service = service;
        this.query = query;
        this.audit = audit;
    }

    public PartnerListResponse list(String q, Boolean active, String debt, int page, int size) {
        return query.list(q, active, debt, Math.max(page, 0), Math.min(Math.max(size, 1), 200));
    }

    public PartnerRow get(UUID id) {
        return query.get(id);
    }

    /** 404 nếu không có đối tác. */
    public List<LedgerRow> ledger(UUID id) {
        query.get(id);
        return query.ledger(id);
    }

    public List<SettlementRow> settlements(UUID id) {
        return query.settlements(id);
    }

    /** Vận đơn chờ đối soát trong các chi nhánh người dùng được làm việc (branchId: lọc 1 chi nhánh). */
    public List<ReconcileRow> reconcilable(UUID id, UUID branchId, Actor actor) {
        var allowed = actor.branchIds().stream().map(UUID::fromString).toList();
        return query.reconcilable(id, branchId == null ? allowed : allowed.stream().filter(branchId::equals).toList());
    }

    public PartnerRow create(PartnerRequest req, Actor actor) {
        PartnerRow r = query.get(service.create(req, actor));
        actor.audit(audit, null, FEATURE, "Tạo", r.code(), "Tạo đối tác giao hàng " + r.code() + " " + r.name());
        return r;
    }

    public PartnerRow update(UUID id, PartnerRequest req, Actor actor) {
        service.update(id, req);
        PartnerRow r = query.get(id);
        actor.audit(audit, null, FEATURE, "Sửa", r.code(), "Cập nhật đối tác giao hàng " + r.code() + " " + r.name()
                + (r.active() ? "" : " (ngừng hoạt động)"));
        return r;
    }

    public void delete(UUID id, Actor actor) {
        String code = service.delete(id);
        actor.audit(audit, null, FEATURE, "Xóa", code, "Xóa đối tác giao hàng " + code);
    }
}
