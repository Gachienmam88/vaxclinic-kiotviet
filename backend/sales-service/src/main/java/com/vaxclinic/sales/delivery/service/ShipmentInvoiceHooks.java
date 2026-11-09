package com.vaxclinic.sales.delivery.service;

import com.vaxclinic.sales.delivery.dto.ShipmentDtos;
import com.vaxclinic.common.address.AdminUnitCodes;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.dto.ShipmentDtos.DeliveryInput;
import com.vaxclinic.sales.delivery.dto.ShipmentDtos.ShipmentInfo;
import com.vaxclinic.sales.invoice.entity.Invoice;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Vận đơn gắn với hóa đơn "Bán giao hàng": kiểm tra trước khi xuất kho, tạo / cập nhật trong transaction của hóa đơn,
 * chặn sửa / hủy hóa đơn khi đã lấy hàng, hủy vận đơn khi hủy hóa đơn. Thu hộ = khách cần trả − đã trả.
 * 1 hóa đơn có thể có nhiều vận đơn (vận đơn cũ đã hủy) nhưng chỉ 1 vận đơn đang hoạt động (chưa hủy) — mọi thao tác
 * theo hóa đơn chỉ nhìn vận đơn đang hoạt động.
 */
@Component
public class ShipmentInvoiceHooks {

    private final JdbcTemplate jdbc;

    public ShipmentInvoiceHooks(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Gọi TRƯỚC khi xuất kho: Bán giao hàng phải có thông tin giao + đối tác đang hoạt động. */
    public void validate(String saleMode, DeliveryInput d) {
        if (d == null) {
            if ("DELIVERY".equals(saleMode)) {
                throw BusinessException.badRequest("DELIVERY_REQUIRED", "Bán giao hàng: chưa nhập thông tin giao hàng");
            }
            return;
        }
        if (!"DELIVERY".equals(saleMode)) {
            throw BusinessException.badRequest("DELIVERY_MODE", "Thông tin giao hàng chỉ dùng cho chế độ Bán giao hàng");
        }
        Boolean active = jdbc.query("select active from delivery_partners where id = ?",
                rs -> rs.next() ? rs.getBoolean(1) : null, d.partnerId());
        if (!Boolean.TRUE.equals(active)) {
            throw BusinessException.badRequest("PARTNER_NOT_FOUND", "Đối tác giao hàng không tồn tại hoặc đã ngừng hoạt động");
        }
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public UUID createForInvoice(Invoice inv, DeliveryInput d, Actor actor) {
        if (d == null) {
            return null;
        }
        UUID id = UUID.randomUUID();
        String code = "VD%06d".formatted(jdbc.queryForObject("select nextval('shipment_code_seq')", Long.class));
        jdbc.update("""
                insert into shipments(id, code, invoice_id, branch_id, partner_id, receiver_name, receiver_phone, receiver_address,
                    area, weight_gram, shipping_fee, fee_payer, cod_amount, note, status, created_by, created_by_name,
                    province_code, ward_code)
                values (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'PENDING', ?,?,?,?)""", id, code, inv.getId(), inv.getBranchId(), d.partnerId(),
                d.receiverName().trim(), d.receiverPhone().trim(), d.receiverAddress().trim(), Actor.blankToNull(d.area()),
                d.weightGram(), money(d.shippingFee()), feePayer(d), cod(inv), Actor.blankToNull(d.note()), actor.id(), actor.name(),
                AdminUnitCodes.clean(d.provinceCode()), AdminUnitCodes.clean(d.wardCode()));
        log(id, null, ShipmentStatus.PENDING, "Tạo vận đơn từ hóa đơn " + inv.getCode(), actor);
        return id;
    }

    /** Sửa / hủy hóa đơn: chỉ khi vận đơn đang hoạt động chưa lấy hàng (hoặc không còn vận đơn hoạt động). */
    public void checkNotPickedUp(UUID invoiceId, String action) {
        String status = statusOf(invoiceId);
        if (status != null && !ShipmentStatus.beforePickup(status)) {
            throw BusinessException.badRequest("SHIPMENT_IN_PROGRESS",
                    "Vận đơn đang ở trạng thái " + ShipmentStatus.label(status) + ", không " + action + " được hóa đơn");
        }
    }

    /** Sau khi ghi bản sửa hóa đơn: cập nhật thông tin giao + thu hộ theo tổng / đã trả mới (thêm vận đơn nếu chưa có vận đơn hoạt động). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void syncOnEdit(Invoice inv, DeliveryInput d, Actor actor) {
        String status = statusOf(inv.getId());
        if (status == null) {
            createForInvoice(inv, d, actor);
            return;
        }
        if (!ShipmentStatus.beforePickup(status)) {
            return;
        }
        if (d == null) {
            jdbc.update("update shipments set cod_amount = ?, updated_at = now() where invoice_id = ? and status <> 'CANCELLED'",
                    cod(inv), inv.getId());
            return;
        }
        jdbc.update("""
                update shipments set partner_id = ?, receiver_name = ?, receiver_phone = ?, receiver_address = ?, area = ?,
                    weight_gram = ?, shipping_fee = ?, fee_payer = ?, cod_amount = ?, note = ?, province_code = ?, ward_code = ?,
                    updated_at = now()
                where invoice_id = ? and status <> 'CANCELLED'""", d.partnerId(), d.receiverName().trim(), d.receiverPhone().trim(),
                d.receiverAddress().trim(), Actor.blankToNull(d.area()), d.weightGram(), money(d.shippingFee()), feePayer(d),
                cod(inv), Actor.blankToNull(d.note()), AdminUnitCodes.clean(d.provinceCode()),
                AdminUnitCodes.clean(d.wardCode()), inv.getId());
    }

    /** Trong transaction hủy hóa đơn: vận đơn đang hoạt động chưa lấy hàng → Đã hủy (ghi lịch sử). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void onInvoiceCancelled(Invoice inv, Actor actor) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select id, status from shipments where invoice_id = ? and status <> 'CANCELLED' for update", inv.getId());
        if (rows.isEmpty() || !ShipmentStatus.beforePickup((String) rows.get(0).get("status"))) {
            return;
        }
        UUID id = (UUID) rows.get(0).get("id");
        markCancelled(id);
        log(id, (String) rows.get(0).get("status"), ShipmentStatus.CANCELLED, "Hủy hóa đơn " + inv.getCode(), actor);
    }

    /** Vận đơn → Đã hủy: bỏ khoản thu hộ (chưa lấy hàng nên chưa ghi sổ đối tác). */
    void markCancelled(UUID shipmentId) {
        jdbc.update("update shipments set status = 'CANCELLED', cod_amount = 0, updated_at = now() where id = ?", shipmentId);
    }

    /** Vận đơn đang hoạt động của hóa đơn; không có thì vận đơn đã hủy gần nhất (chi tiết hóa đơn hiện "Chưa giao"). */
    public ShipmentInfo info(UUID invoiceId) {
        return jdbc.query("""
                select s.*, p.name partner_name, (select r.code from sales_returns r where r.id = s.return_id) return_code
                from shipments s join delivery_partners p on p.id = s.partner_id where s.invoice_id = ?
                order by (s.status = 'CANCELLED'), s.created_at desc limit 1""", rs -> rs.next()
                ? new ShipmentInfo(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("status"),
                rs.getObject("partner_id", UUID.class), rs.getString("partner_name"), rs.getString("receiver_name"),
                rs.getString("receiver_phone"), rs.getString("receiver_address"), rs.getString("area"),
                (Integer) rs.getObject("weight_gram"), rs.getBigDecimal("shipping_fee"), rs.getString("fee_payer"),
                rs.getBigDecimal("cod_amount"), rs.getString("note"),
                rs.getTimestamp("delivered_at") == null ? null : rs.getTimestamp("delivered_at").toInstant(),
                rs.getString("return_code"), rs.getString("province_code"), rs.getString("ward_code")) : null, invoiceId);
    }

    /** Ghi lịch sử đổi trạng thái (thời gian + người thao tác). */
    public void log(UUID shipmentId, String from, String to, String note, Actor actor) {
        jdbc.update("""
                insert into shipment_status_logs(id, shipment_id, from_status, to_status, note, changed_by, changed_by_name)
                values (?,?,?,?,?,?,?)""", UUID.randomUUID(), shipmentId, from, to, note, actor.id(), actor.name());
    }

    /** Trạng thái vận đơn đang hoạt động (null = không có). */
    public String statusOf(UUID invoiceId) {
        return jdbc.query("select status from shipments where invoice_id = ? and status <> 'CANCELLED'",
                rs -> rs.next() ? rs.getString(1) : null, invoiceId);
    }

    private static BigDecimal cod(Invoice inv) {
        return inv.getTotal().subtract(inv.getPaid()).max(BigDecimal.ZERO);
    }

    private static String feePayer(DeliveryInput d) {
        return d.feePayer() == null ? "SHOP" : d.feePayer();
    }

    static BigDecimal money(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v.setScale(0, RoundingMode.HALF_UP);
    }
}
