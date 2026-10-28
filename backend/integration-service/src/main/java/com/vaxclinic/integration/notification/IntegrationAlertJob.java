package com.vaxclinic.integration.notification;

import com.vaxclinic.common.notification.NotificationClient;
import com.vaxclinic.common.notification.NotificationClient.Item;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Cảnh báo tích hợp cho Hộp thư đến:
 * - EINVOICE_FAILED (mỗi 15 phút, quyền settings.manage): hóa đơn phát hành HĐĐT lỗi; tự đóng khi phát hành lại thành công.
 * - SEPAY_RECEIVED (mỗi phút, chỉ khi bật SePay, quyền sales.perform, theo chi nhánh của yêu cầu thanh toán):
 *   nhận chuyển khoản khớp mã thanh toán QR. Dạng sự kiện, không tự đóng; mốc đã gửi giữ trong bộ nhớ
 *   (khởi động lại → quét lại 24 giờ gần nhất, identity bỏ qua bản trùng theo dedupeKey).
 */
@Configuration
@EnableScheduling
public class IntegrationAlertJob {

    private static final Logger log = LoggerFactory.getLogger(IntegrationAlertJob.class);

    private final JdbcTemplate jdbc;
    private final NotificationClient notifications;
    private Instant sepaySince = Instant.now().minus(Duration.ofDays(1));

    public IntegrationAlertJob(JdbcTemplate jdbc, NotificationClient notifications) {
        this.jdbc = jdbc;
        this.notifications = notifications;
    }

    @Scheduled(initialDelay = 55_000, fixedDelay = 15 * 60_000)
    public void einvoiceJob() {
        try {
            einvoiceFailures();
        } catch (RuntimeException e) {
            log.warn("E-invoice alert job failed: {}", e.getMessage());
        }
    }

    @Scheduled(initialDelay = 60_000, fixedDelay = 60_000)
    public void sepayJob() {
        try {
            sepayReceipts();
        } catch (RuntimeException e) {
            log.warn("SePay alert job failed: {}", e.getMessage());
        }
    }

    /** Hóa đơn phát hành HĐĐT lỗi; trả số cảnh báo đã gửi (-1 nếu không gửi được). */
    public synchronized int einvoiceFailures() {
        List<Item> items = jdbc.query("""
                select invoice_id, invoice_code, error, attempts from einvoice_records where status = 'FAILED'
                order by updated_at""", (rs, i) -> {
            String code = rs.getString("invoice_code");
            String error = rs.getString("error");
            String body = (error == null || error.isBlank() ? "Không rõ lý do" : cut(error, 500))
                    + ". Kiểm tra thiết lập Hóa đơn điện tử rồi phát hành lại từ chi tiết hóa đơn.";
            return new Item("EINVOICE_FAILED", "einvoice_failed:" + rs.getObject("invoice_id", UUID.class),
                    "Hóa đơn " + code + " phát hành hóa đơn điện tử lỗi", body, code, null, null, "settings.manage");
        });
        return notifications.sync(List.of("EINVOICE_FAILED"), items) ? items.size() : -1;
    }

    /** Giao dịch chuyển khoản mới khớp yêu cầu thanh toán; trả số thông báo đã gửi (-1 nếu không gửi được). */
    public synchronized int sepayReceipts() {
        Boolean enabled = jdbc.query("select enabled from sepay_settings where id = 1",
                rs -> rs.next() ? rs.getBoolean(1) : Boolean.FALSE);
        if (!Boolean.TRUE.equals(enabled)) {
            return 0;
        }
        record Row(Item item, Instant receivedAt) {
        }
        List<Row> rows = jdbc.query("""
                select t.sepay_id, t.amount, t.gateway, t.content, t.payment_code, t.received_at, p.branch_id
                from bank_transactions t join payment_requests p on p.code = t.payment_code
                where t.received_at > ? order by t.received_at limit 500""", (rs, i) -> {
            String amount = String.format("%,.0f", rs.getBigDecimal("amount") == null ? BigDecimal.ZERO : rs.getBigDecimal("amount"));
            String gateway = rs.getString("gateway");
            String title = "Nhận chuyển khoản " + amount + "đ" + (gateway == null ? "" : " qua " + gateway)
                    + " cho mã thanh toán " + rs.getString("payment_code");
            Item item = new Item("SEPAY_RECEIVED", "sepay:" + rs.getLong("sepay_id"), title,
                    "Nội dung: " + cut(rs.getString("content"), 300), null, null, rs.getObject("branch_id", UUID.class),
                    "sales.perform");
            return new Row(item, rs.getTimestamp("received_at").toInstant());
        }, Timestamp.from(sepaySince));
        if (rows.isEmpty()) {
            return 0;
        }
        if (!notifications.publish(rows.stream().map(Row::item).toList())) {
            return -1;
        }
        sepaySince = rows.get(rows.size() - 1).receivedAt();
        return rows.size();
    }

    private static String cut(String s, int max) {
        return s == null || s.length() <= max ? String.valueOf(s) : s.substring(0, max) + "…";
    }
}
