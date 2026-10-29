package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.ShipmentDtos.CreateRequest;
import com.vaxclinic.sales.delivery.ShipmentDtos.ShipmentDetail;
import com.vaxclinic.sales.delivery.ShipmentDtos.ShipmentListResponse;
import com.vaxclinic.sales.delivery.ShipmentDtos.StatusRequest;
import com.vaxclinic.sales.delivery.ShipmentDtos.StatusResult;
import com.vaxclinic.sales.delivery.ShipmentDtos.UpdateRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Vận đơn cho màn hình: danh sách / chi tiết (giới hạn trong chi nhánh người dùng được làm việc), tạo
 * ({@link ShipmentCreateService}), sửa thông tin giao ({@link ShipmentEditService}), đổi trạng thái
 * ({@link ShipmentStatusService}). Trả chi tiết đọc lại sau khi ghi xong rồi ghi lịch sử thao tác.
 */
@Service
public class ShipmentManageService {

    /** Bộ lọc danh sách từ query string (chưa giới hạn chi nhánh / trang). */
    public record ListRequest(String q, List<String> statuses, UUID partnerId, String area, String provinceCode, Instant from,
                              Instant to, UUID branchId, Boolean reconciled, int page, int size, Instant completedFrom,
                              Instant completedTo, Boolean cod, String connection) {
    }

    private final ShipmentQueryRepository query;
    private final ShipmentStatusService status;
    private final ShipmentEditService edit;
    private final ShipmentCreateService creator;
    private final AuditLogger audit;
    private final ShipmentInvoiceHooks hooks;
    private final ShipmentDashboardRepository dashboards;

    public ShipmentManageService(ShipmentQueryRepository query, ShipmentStatusService status, ShipmentEditService edit,
                                 ShipmentCreateService creator, AuditLogger audit, ShipmentInvoiceHooks hooks,
                                 ShipmentDashboardRepository dashboards) {
        this.dashboards = dashboards;
        this.hooks = hooks;
        this.query = query;
        this.status = status;
        this.edit = edit;
        this.creator = creator;
        this.audit = audit;
    }

    /** "Tạo vận đơn" cho hóa đơn đã bán (vận đơn cũ đã hủy / giao lại qua đối tác khác). */
    public ShipmentDetail create(CreateRequest req, Actor actor) {
        UUID id = creator.create(req, actor);
        ShipmentDetail d = query.detail(id, branches(actor, null));
        actor.audit(audit, d.item().branchId(), "Vận đơn", "Tạo", d.item().code(), "Tạo vận đơn " + d.item().code() + " cho hóa đơn "
                + d.item().invoiceCode() + ", đối tác " + d.item().partnerName() + ", thu hộ " + Actor.money(d.item().codAmount()));
        return d;
    }

    public ShipmentListResponse list(ListRequest r, Actor actor) {
        return query.search(new ShipmentQueryRepository.Filter(r.q(), r.statuses(), r.partnerId(), r.area(), r.provinceCode(), r.from(), r.to(),
                branches(actor, r.branchId()), r.reconciled(), Math.max(r.page(), 0), Math.min(Math.max(r.size(), 1), 200),
                r.completedFrom(), r.completedTo(), r.cod(), r.connection()));
    }

    /** Quản lý giao hàng → Thống kê (vận đơn tạo trong [from, to)). */
    public ShipmentDtos.Dashboard dashboard(Instant from, Instant to, UUID partnerId, String connection, Actor actor) {
        return dashboards.dashboard(new ShipmentDashboardRepository.Scope(branches(actor, null), from, to, partnerId, connection));
    }

    /** Quản lý giao hàng → Dòng tiền (sổ công nợ đối tác trong [from, to) + còn lại hiện tại). */
    public ShipmentDtos.Cashflow cashflow(Instant from, Instant to, UUID partnerId, String connection, Actor actor) {
        return dashboards.cashflow(new ShipmentDashboardRepository.Scope(branches(actor, null), from, to, partnerId, connection));
    }

    public ShipmentDetail get(UUID id, Actor actor) {
        return query.detail(id, branches(actor, null));
    }

    public ShipmentDetail update(UUID id, UpdateRequest req, Actor actor) {
        String code = edit.update(id, req, actor);
        ShipmentDetail d = query.detail(id, branches(actor, null));
        actor.audit(audit, d.item().branchId(), "Vận đơn", "Sửa", code, "Cập nhật thông tin giao vận đơn " + code
                + ": người nhận " + d.item().receiverName() + ", phí " + Actor.money(d.item().shippingFee()));
        return d;
    }

    /** Tỷ lệ giao thành công theo SĐT người nhận (badge % ở màn bán hàng). */
    public ShipmentDtos.ReceiverStats receiverStats(String phone) {
        return hooks.receiverStats(phone == null ? "" : phone);
    }

    /** Cập nhật trạng thái hàng loạt; trả kết quả từng vận đơn. */
    public List<StatusResult> changeStatus(StatusRequest req, Actor actor) {
        return status.changeAll(req.ids(), req.status(), req.note(), req.returnOptions(), actor);
    }

    /** Chi nhánh người dùng được làm việc, giao với branchId nếu có. */
    private static List<UUID> branches(Actor actor, UUID branchId) {
        var allowed = actor.branchIds().stream().map(UUID::fromString).toList();
        return branchId == null ? allowed : allowed.stream().filter(branchId::equals).toList();
    }
}
