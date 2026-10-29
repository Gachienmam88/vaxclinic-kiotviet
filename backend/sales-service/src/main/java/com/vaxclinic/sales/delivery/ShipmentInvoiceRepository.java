package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.address.AdminUnitCodes;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.ShipmentDtos.DeliveryInput;
import com.vaxclinic.sales.delivery.ShipmentDtos.ShipmentInfo;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Vận đơn theo hóa đơn: vận đơn đang hoạt động (chưa hủy), thông tin giao hiển thị ở hóa đơn, cập nhật khi sửa hóa đơn. */
@Repository
public class ShipmentInvoiceRepository {

    private final JdbcTemplate jdbc;

    public ShipmentInvoiceRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Trạng thái vận đơn đang hoạt động (null = không có). */
    public String activeStatus(UUID invoiceId) {
        return jdbc.query("select status from shipments where invoice_id = ? and status <> 'CANCELLED'",
                rs -> rs.next() ? rs.getString(1) : null, invoiceId);
    }

    /** Khóa vận đơn đang hoạt động của hóa đơn (id, status; rỗng = không có). */
    public List<Map<String, Object>> lockActive(UUID invoiceId) {
        return jdbc.queryForList(
                "select id, status from shipments where invoice_id = ? and status <> 'CANCELLED' for update", invoiceId);
    }

    /** Chỉ cập nhật thu hộ của vận đơn đang hoạt động. */
    public void updateCod(UUID invoiceId, BigDecimal cod) {
        jdbc.update("""
                update shipments set cod_amount = case when cod_enabled then ? else 0 end, updated_at = now()
                where invoice_id = ? and status <> 'CANCELLED'""", cod, invoiceId);
    }

    /** Cập nhật thông tin giao + thu hộ của vận đơn đang hoạt động; shippingFee / feePayer / cod đã tính sẵn. */
    public void updateDelivery(UUID invoiceId, DeliveryInput d, BigDecimal shippingFee, String feePayer, BigDecimal cod) {
        jdbc.update("""
                update shipments set partner_id = ?, receiver_name = ?, receiver_phone = ?, receiver_address = ?, area = ?,
                    weight_gram = ?, shipping_fee = ?, fee_payer = ?, cod_amount = ?, note = ?, province_code = ?, ward_code = ?,
                    service_type = ?, waybill_code = ?, expected_delivery_at = ?, package_count = ?, length_cm = ?, width_cm = ?,
                    height_cm = ?, cod_enabled = ?, updated_at = now()
                where invoice_id = ? and status <> 'CANCELLED'""", d.partnerId(), d.receiverName().trim(), d.receiverPhone().trim(),
                d.receiverAddress().trim(), Actor.blankToNull(d.area()), d.weightGram(), shippingFee, feePayer,
                cod, Actor.blankToNull(d.note()), AdminUnitCodes.clean(d.provinceCode()),
                AdminUnitCodes.clean(d.wardCode()), ShipmentRepository.serviceType(d), Actor.blankToNull(d.waybillCode()),
                ShipmentRepository.ts(d.expectedDeliveryAt()), ShipmentRepository.packageCount(d), d.lengthCm(), d.widthCm(),
                d.heightCm(), d.collectsCod(), invoiceId);
    }

    /** Vận đơn đang hoạt động của hóa đơn; không có thì vận đơn đã hủy gần nhất (null = hóa đơn chưa có vận đơn). */
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
                rs.getString("return_code"), rs.getString("province_code"), rs.getString("ward_code"),
                rs.getString("service_type"), rs.getString("waybill_code"), instant(rs.getTimestamp("expected_delivery_at")),
                rs.getInt("package_count"), (Integer) rs.getObject("length_cm"), (Integer) rs.getObject("width_cm"),
                (Integer) rs.getObject("height_cm"), rs.getBoolean("cod_enabled"), instant(rs.getTimestamp("created_at")))
                : null, invoiceId);
    }

    /** Tỷ lệ giao thành công theo SĐT người nhận (vận đơn đã kết thúc: Giao thành công / Đã chuyển hoàn). */
    public ShipmentDtos.ReceiverStats receiverStats(String phone) {
        return jdbc.queryForObject("""
                select count(*) filter (where status in ('DELIVERED', 'RETURNED')) finished,
                       count(*) filter (where status = 'DELIVERED') delivered
                from shipments where receiver_phone = ?""", (rs, n) -> {
            long finished = rs.getLong("finished");
            long delivered = rs.getLong("delivered");
            return new ShipmentDtos.ReceiverStats(finished, delivered,
                    finished == 0 ? null : (int) Math.round(delivered * 100.0 / finished));
        }, phone.trim());
    }

    private static Instant instant(Timestamp t) {
        return t == null ? null : t.toInstant();
    }

    /** Khách của hóa đơn (null = khách lẻ / không có hóa đơn). */
    public UUID invoiceCustomerId(UUID invoiceId) {
        return jdbc.query("select customer_id from invoices where id = ?",
                rs -> rs.next() ? rs.getObject(1, UUID.class) : null, invoiceId);
    }
}
