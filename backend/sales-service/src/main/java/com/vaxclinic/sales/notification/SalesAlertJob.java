package com.vaxclinic.sales.notification;

import com.vaxclinic.common.notification.NotificationClient;
import com.vaxclinic.common.notification.NotificationClient.Item;
import com.vaxclinic.common.settings.ShopSettings;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Cảnh báo bán hàng cho Hộp thư đến (mỗi 15 phút + sau khi khởi động), theo chi nhánh, quyền sales.perform:
 * - ORDER_DUE: đơn đặt hàng chưa xong (phiếu tạm / đã xác nhận) có thời gian giao hàng hôm nay hoặc đã quá hạn;
 * - SHIPMENT_RETURNING: vận đơn đang chuyển hoàn (cần nhận lại hàng).
 * Gửi trọn bộ mỗi lần → identity tự đóng cảnh báo không còn đúng (đơn đã tạo hóa đơn / hủy, vận đơn đã hoàn xong).
 */
@Configuration
@EnableScheduling
public class SalesAlertJob {

    static final List<String> TYPES = List.of("ORDER_DUE", "SHIPMENT_RETURNING");
    private static final String PERMISSION = "sales.perform";
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");
    private static final Logger log = LoggerFactory.getLogger(SalesAlertJob.class);

    private final JdbcTemplate jdbc;
    private final NotificationClient notifications;

    public SalesAlertJob(JdbcTemplate jdbc, NotificationClient notifications) {
        this.jdbc = jdbc;
        this.notifications = notifications;
    }

    @Scheduled(initialDelay = 50_000, fixedDelay = 15 * 60_000)
    public void scheduled() {
        try {
            run();
        } catch (RuntimeException e) {
            log.warn("Sales alert job failed: {}", e.getMessage());
        }
    }

    /** Chạy ngay; trả số cảnh báo đang đúng đã gửi (-1 nếu không gửi được sang identity-service). */
    public synchronized int run() {
        LocalDate today = LocalDate.now(ShopSettings.ZONE);
        List<Item> items = new ArrayList<>(dueOrders(today));
        items.addAll(returningShipments());
        return notifications.sync(TYPES, items) ? items.size() : -1;
    }

    private List<Item> dueOrders(LocalDate today) {
        Timestamp tomorrow = Timestamp.from(today.plusDays(1).atStartOfDay(ShopSettings.ZONE).toInstant());
        Timestamp startOfToday = Timestamp.from(today.atStartOfDay(ShopSettings.ZONE).toInstant());
        return jdbc.query("""
                select id, code, branch_id, customer_name, expected_delivery_at from customer_orders
                where status in ('DRAFT', 'CONFIRMED') and expected_delivery_at < ?
                order by expected_delivery_at""", (rs, i) -> {
            ZonedDateTime due = rs.getTimestamp("expected_delivery_at").toInstant().atZone(ShopSettings.ZONE);
            boolean overdue = rs.getTimestamp("expected_delivery_at").before(startOfToday);
            String code = rs.getString("code");
            String title = "Đơn đặt hàng " + code + " - " + rs.getString("customer_name")
                    + (overdue ? " đã quá hạn giao" : " đến hạn giao hôm nay lúc " + due.format(TIME));
            String body = "Thời gian giao hàng " + due.format(DATE_TIME) + ". Tạo hóa đơn giao hàng hoặc cập nhật lại thời gian giao.";
            return new Item("ORDER_DUE", "order_due:" + rs.getObject("id", UUID.class), title, body, code, null,
                    rs.getObject("branch_id", UUID.class), PERMISSION);
        }, tomorrow);
    }

    private List<Item> returningShipments() {
        return jdbc.query("""
                select id, code, branch_id, receiver_name, receiver_phone from shipments where status = 'RETURNING'
                order by updated_at""", (rs, i) -> {
            String code = rs.getString("code");
            String title = "Vận đơn " + code + " - " + rs.getString("receiver_name") + " đang chuyển hoàn";
            String body = "Người nhận " + rs.getString("receiver_name") + " (" + rs.getString("receiver_phone")
                    + "). Nhận lại hàng và cập nhật trạng thái \"Đã chuyển hoàn\" khi hàng về kho.";
            return new Item("SHIPMENT_RETURNING", "shipment_returning:" + rs.getObject("id", UUID.class), title, body, code,
                    null, rs.getObject("branch_id", UUID.class), PERMISSION);
        });
    }
}
