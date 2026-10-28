package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.ShipmentDtos.CreateRequest;
import com.vaxclinic.sales.delivery.ShipmentDtos.ShipmentDetail;
import com.vaxclinic.sales.delivery.ShipmentDtos.ShipmentListResponse;
import com.vaxclinic.sales.delivery.ShipmentDtos.StatusRequest;
import com.vaxclinic.sales.delivery.ShipmentDtos.StatusResult;
import com.vaxclinic.sales.delivery.ShipmentDtos.UpdateRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Vận đơn (tạo cùng hóa đơn Bán giao hàng ở màn bán hàng): danh sách / chi tiết, sửa thông tin giao, đổi trạng thái
 * (1 hoặc nhiều vận đơn), "Tạo vận đơn" cho hóa đơn chưa có vận đơn hoạt động. Đã hủy chỉ hủy vận đơn (hóa đơn giữ nguyên,
 * hủy bán = hủy hóa đơn) nên chỉ cần sales.perform. Chưa tích hợp API hãng vận chuyển.
 */
@RestController
@RequestMapping("/api/shipments")
@PreAuthorize("hasAuthority('sales.perform') or hasAuthority('report.view')")
public class ShipmentController {

    private final ShipmentQuery query;
    private final ShipmentStatusService status;
    private final ShipmentEditService edit;
    private final ShipmentCreateService creator;
    private final AuditLogger audit;

    public ShipmentController(ShipmentQuery query, ShipmentStatusService status, ShipmentEditService edit,
                              ShipmentCreateService creator, AuditLogger audit) {
        this.query = query;
        this.status = status;
        this.edit = edit;
        this.creator = creator;
        this.audit = audit;
    }

    /** "Tạo vận đơn" cho hóa đơn đã bán (vận đơn cũ đã hủy / giao lại qua đối tác khác). */
    @PostMapping
    @PreAuthorize("hasAuthority('sales.perform')")
    @ResponseStatus(HttpStatus.CREATED)
    public ShipmentDetail create(@Valid @RequestBody CreateRequest req, @AuthenticationPrincipal Jwt jwt) {
        Actor actor = Actor.of(jwt);
        UUID id = creator.create(req, actor);
        ShipmentDetail d = query.detail(id, branches(jwt, null));
        actor.audit(audit, d.item().branchId(), "Vận đơn", "Tạo", d.item().code(), "Tạo vận đơn " + d.item().code() + " cho hóa đơn "
                + d.item().invoiceCode() + ", đối tác " + d.item().partnerName() + ", thu hộ " + Actor.money(d.item().codAmount()));
        return d;
    }

    @GetMapping
    public ShipmentListResponse list(@RequestParam(required = false) String q, @RequestParam(required = false) List<String> statuses,
                                     @RequestParam(required = false) UUID partnerId, @RequestParam(required = false) String area,
                                     @RequestParam(required = false) String provinceCode,
                                     @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
                                     @RequestParam(required = false) UUID branchId, @RequestParam(required = false) Boolean reconciled,
                                     @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "15") int size,
                                     @AuthenticationPrincipal Jwt jwt) {
        return query.search(new ShipmentQuery.Filter(q, statuses, partnerId, area, provinceCode, from, to, branches(jwt, branchId), reconciled,
                Math.max(page, 0), Math.min(Math.max(size, 1), 200)));
    }

    @GetMapping("/{id}")
    public ShipmentDetail get(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return query.detail(id, branches(jwt, null));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('sales.perform')")
    public ShipmentDetail update(@PathVariable UUID id, @Valid @RequestBody UpdateRequest req, @AuthenticationPrincipal Jwt jwt) {
        Actor actor = Actor.of(jwt);
        String code = edit.update(id, req, actor);
        ShipmentDetail d = query.detail(id, branches(jwt, null));
        actor.audit(audit, d.item().branchId(), "Vận đơn", "Sửa", code, "Cập nhật thông tin giao vận đơn " + code
                + ": người nhận " + d.item().receiverName() + ", phí " + Actor.money(d.item().shippingFee()));
        return d;
    }

    /** Cập nhật trạng thái hàng loạt; trả kết quả từng vận đơn. */
    @PostMapping("/status")
    @PreAuthorize("hasAuthority('sales.perform')")
    public List<StatusResult> changeStatus(@Valid @RequestBody StatusRequest req, @AuthenticationPrincipal Jwt jwt) {
        return status.changeAll(req.ids(), req.status(), req.note(), req.returnOptions(), Actor.of(jwt));
    }

    private static List<UUID> branches(Jwt jwt, UUID branchId) {
        var allowed = Actor.of(jwt).branchIds().stream().map(UUID::fromString).toList();
        return branchId == null ? allowed : allowed.stream().filter(branchId::equals).toList();
    }
}
