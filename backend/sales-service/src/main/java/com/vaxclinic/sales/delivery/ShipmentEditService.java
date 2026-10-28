package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.ShipmentDtos.DeliveryInput;
import com.vaxclinic.sales.delivery.ShipmentDtos.UpdateRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

/** Sửa thông tin giao (người nhận, đối tác, phí...) khi vận đơn chưa lấy hàng. Thu hộ giữ theo hóa đơn. */
@Service
public class ShipmentEditService {

    private final JdbcTemplate jdbc;
    private final ShipmentInvoiceHooks hooks;

    public ShipmentEditService(JdbcTemplate jdbc, ShipmentInvoiceHooks hooks) {
        this.jdbc = jdbc;
        this.hooks = hooks;
    }

    /** Trả về mã vận đơn (ghi lịch sử thao tác). */
    @Transactional
    public String update(UUID id, UpdateRequest r, Actor actor) {
        var rows = jdbc.queryForList("select code, status, branch_id from shipments where id = ? for update", id);
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
                r.area(), r.weightGram(), r.shippingFee(), r.feePayer(), r.note()));
        jdbc.update("""
                update shipments set partner_id = ?, receiver_name = ?, receiver_phone = ?, receiver_address = ?, area = ?,
                    weight_gram = ?, shipping_fee = ?, fee_payer = ?, note = ?, updated_at = now() where id = ?""",
                r.partnerId(), r.receiverName().trim(), r.receiverPhone().trim(), r.receiverAddress().trim(),
                Actor.blankToNull(r.area()), r.weightGram(), ShipmentInvoiceHooks.money(r.shippingFee()),
                r.feePayer() == null ? "SHOP" : r.feePayer(), Actor.blankToNull(r.note()), id);
        return (String) s.get("code");
    }
}
