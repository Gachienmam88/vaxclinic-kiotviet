package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.ShipmentDtos.DeliveryInput;
import com.vaxclinic.sales.delivery.ShipmentDtos.UpdateRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

/** Sửa thông tin giao (người nhận, đối tác, phí...) khi vận đơn chưa lấy hàng. Thu hộ giữ theo hóa đơn. */
@Service
public class ShipmentEditService {

    private final ShipmentRepository shipments;
    private final ShipmentInvoiceHooks hooks;

    public ShipmentEditService(ShipmentRepository shipments, ShipmentInvoiceHooks hooks) {
        this.shipments = shipments;
        this.hooks = hooks;
    }

    /** Trả về mã vận đơn (ghi lịch sử thao tác). */
    @Transactional
    public String update(UUID id, UpdateRequest r, Actor actor) {
        var rows = shipments.lockForEdit(id);
        if (rows.isEmpty()) {
            throw BusinessException.notFound("SHIPMENT_NOT_FOUND", "Không tìm thấy vận đơn");
        }
        Map<String, Object> s = rows.get(0);
        actor.checkBranch((UUID) s.get("branch_id"));
        if (!ShipmentStatus.beforePickup((String) s.get("status"))) {
            throw BusinessException.badRequest("SHIPMENT_IN_PROGRESS", "Vận đơn " + ShipmentStatus.label((String) s.get("status"))
                    + ": chỉ sửa được khi Chờ xử lý / Đang lấy hàng");
        }
        hooks.validate("DELIVERY", new DeliveryInput(r.partnerId(), r.receiverName(), r.receiverPhone(), r.receiverAddress(),
                r.area(), r.weightGram(), r.shippingFee(), r.feePayer(), r.note(), r.provinceCode(), r.wardCode(),
                null, null, null, null, null, null, null, null, null));
        shipments.updateDelivery(id, r, ShipmentInvoiceHooks.money(r.shippingFee()), r.feePayer() == null ? "SHOP" : r.feePayer());
        return (String) s.get("code");
    }
}
