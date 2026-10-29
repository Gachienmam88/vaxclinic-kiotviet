package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.address.AdminUnitCodes;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.ShipmentDtos.DeliveryInput;
import com.vaxclinic.sales.delivery.ShipmentDtos.UpdateRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Ghi / đọc 1 vận đơn theo id (tạo, sửa thông tin giao, đổi trạng thái, khóa dòng) + lịch sử trạng thái. */
@Repository
public class ShipmentRepository {

    private final JdbcTemplate jdbc;

    public ShipmentRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Long nextCodeNumber() {
        return jdbc.queryForObject("select nextval('shipment_code_seq')", Long.class);
    }

    /** Vận đơn mới (Chờ xử lý) của hóa đơn; shippingFee / feePayer / cod đã tính sẵn. */
    public void insert(UUID id, String code, UUID invoiceId, UUID branchId, DeliveryInput d, BigDecimal shippingFee,
                       String feePayer, BigDecimal cod, UUID createdBy, String createdByName) {
        jdbc.update("""
                insert into shipments(id, code, invoice_id, branch_id, partner_id, receiver_name, receiver_phone, receiver_address,
                    area, weight_gram, shipping_fee, fee_payer, cod_amount, note, status, created_by, created_by_name,
                    province_code, ward_code)
                values (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'PENDING', ?,?,?,?)""", id, code, invoiceId, branchId, d.partnerId(),
                d.receiverName().trim(), d.receiverPhone().trim(), d.receiverAddress().trim(), Actor.blankToNull(d.area()),
                d.weightGram(), shippingFee, feePayer, cod, Actor.blankToNull(d.note()), createdBy, createdByName,
                AdminUnitCodes.clean(d.provinceCode()), AdminUnitCodes.clean(d.wardCode()));
    }

    /** Toàn bộ cột vận đơn (rỗng = không có). */
    public List<Map<String, Object>> find(UUID id) {
        return jdbc.queryForList("select * from shipments where id = ?", id);
    }

    public String codeOf(UUID id) {
        return jdbc.query("select code from shipments where id = ?", rs -> rs.next() ? rs.getString(1) : null, id);
    }

    /** Khóa dòng vận đơn để đổi trạng thái (ném EmptyResultDataAccessException nếu không có). */
    public Map<String, Object> lockForUpdate(UUID id) {
        return jdbc.queryForMap("select * from shipments where id = ? for update", id);
    }

    /** Khóa dòng vận đơn để sửa thông tin giao (code, status, branch_id; rỗng = không có). */
    public List<Map<String, Object>> lockForEdit(UUID id) {
        return jdbc.queryForList("select code, status, branch_id from shipments where id = ? for update", id);
    }

    /** Sửa thông tin giao; shippingFee / feePayer đã chuẩn hóa. */
    public void updateDelivery(UUID id, UpdateRequest r, BigDecimal shippingFee, String feePayer) {
        jdbc.update("""
                update shipments set partner_id = ?, receiver_name = ?, receiver_phone = ?, receiver_address = ?, area = ?,
                    weight_gram = ?, shipping_fee = ?, fee_payer = ?, note = ?, province_code = ?, ward_code = ?, updated_at = now()
                where id = ?""",
                r.partnerId(), r.receiverName().trim(), r.receiverPhone().trim(), r.receiverAddress().trim(),
                Actor.blankToNull(r.area()), r.weightGram(), shippingFee, feePayer, Actor.blankToNull(r.note()),
                AdminUnitCodes.clean(r.provinceCode()), AdminUnitCodes.clean(r.wardCode()), id);
    }

    /** Ghi trạng thái mới + số đã ghi sổ; finished = Giao thành công / Đã chuyển hoàn (ghi delivered_at = at). */
    public void updateStatus(UUID id, String to, UUID returnId, BigDecimal codPosted, BigDecimal feePosted, BigDecimal returnFee,
                             boolean finished, Instant at) {
        jdbc.update("""
                update shipments set status = ?, return_id = coalesce(?, return_id), cod_posted = ?, fee_posted = ?, return_fee = ?,
                    delivered_at = case when ? then ? else delivered_at end, updated_at = now() where id = ?""",
                to, returnId, codPosted, feePosted, returnFee, finished, Timestamp.from(at), id);
    }

    /** Vận đơn → Đã hủy, bỏ khoản thu hộ. */
    public void markCancelled(UUID id) {
        jdbc.update("update shipments set status = 'CANCELLED', cod_amount = 0, updated_at = now() where id = ?", id);
    }

    public void insertLog(UUID shipmentId, String from, String to, String note, UUID changedBy, String changedByName) {
        jdbc.update("""
                insert into shipment_status_logs(id, shipment_id, from_status, to_status, note, changed_by, changed_by_name)
                values (?,?,?,?,?,?,?)""", UUID.randomUUID(), shipmentId, from, to, note, changedBy, changedByName);
    }
}
