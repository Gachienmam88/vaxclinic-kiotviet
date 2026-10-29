package com.vaxclinic.sales.notification;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;

/** Dữ liệu thô cho cảnh báo bán hàng: đơn đặt hàng đến / quá hạn giao, vận đơn đang chuyển hoàn. Nội dung dựng ở {@link SalesAlertJob}. */
@Repository
public class SalesAlertRepository {

    public record DueOrder(UUID id, String code, UUID branchId, String customerName, Timestamp expectedDeliveryAt) {
    }

    public record ReturningShipment(UUID id, String code, UUID branchId, String receiverName, String receiverPhone) {
    }

    private final JdbcTemplate jdbc;

    public SalesAlertRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Đơn chưa xong (phiếu tạm / đã xác nhận) có thời gian giao trước before, sớm nhất trước. */
    public List<DueOrder> dueOrders(Timestamp before) {
        return jdbc.query("""
                select id, code, branch_id, customer_name, expected_delivery_at from customer_orders
                where status in ('DRAFT', 'CONFIRMED') and expected_delivery_at < ?
                order by expected_delivery_at""", (rs, i) -> new DueOrder(rs.getObject("id", UUID.class), rs.getString("code"),
                rs.getObject("branch_id", UUID.class), rs.getString("customer_name"), rs.getTimestamp("expected_delivery_at")), before);
    }

    public List<ReturningShipment> returningShipments() {
        return jdbc.query("""
                select id, code, branch_id, receiver_name, receiver_phone from shipments where status = 'RETURNING'
                order by updated_at""", (rs, i) -> new ReturningShipment(rs.getObject("id", UUID.class), rs.getString("code"),
                rs.getObject("branch_id", UUID.class), rs.getString("receiver_name"), rs.getString("receiver_phone")));
    }
}
