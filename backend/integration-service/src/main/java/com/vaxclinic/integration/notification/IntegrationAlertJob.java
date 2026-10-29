package com.vaxclinic.integration.notification;

import com.vaxclinic.common.notification.NotificationClient;
import com.vaxclinic.common.notification.NotificationClient.Item;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Cảnh báo tích hợp cho Hộp thư đến:
 * - EINVOICE_FAILED (mỗi 15 phút, quyền sales.perform — nhân viên bán hàng phát hành lại được): hóa đơn phát hành HĐĐT lỗi; tự đóng khi phát hành lại thành công.
 * - SEPAY_RECEIVED (mỗi phút, chỉ khi bật SePay, quyền sales.perform, theo chi nhánh của yêu cầu thanh toán):
 *   nhận chuyển khoản khớp mã thanh toán QR. Dạng sự kiện, không tự đóng; mốc đã gửi giữ trong bộ nhớ
 *   (khởi động lại → quét lại 24 giờ gần nhất, identity bỏ qua bản trùng theo dedupeKey).
 */
@Configuration
@EnableScheduling
public class IntegrationAlertJob {

    private static final Logger log = LoggerFactory.getLogger(IntegrationAlertJob.class);

    private final IntegrationAlertRepository repo;
    private final NotificationClient notifications;
    private Instant sepaySince = Instant.now().minus(Duration.ofDays(1));

    public IntegrationAlertJob(IntegrationAlertRepository repo, NotificationClient notifications) {
        this.repo = repo;
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
        List<Item> items = repo.failedEInvoices().stream().map(f -> {
            String code = f.invoiceCode();
            String error = f.error();
            String body = (error == null || error.isBlank() ? "Không rõ lý do" : cut(error, 500))
                    + ". Kiểm tra thiết lập Hóa đơn điện tử rồi phát hành lại từ chi tiết hóa đơn.";
            return new Item("EINVOICE_FAILED", "einvoice_failed:" + f.invoiceId(),
                    "Hóa đơn " + code + " phát hành hóa đơn điện tử lỗi", body, code, null, null, "sales.perform");
        }).toList();
        return notifications.sync(List.of("EINVOICE_FAILED"), items) ? items.size() : -1;
    }

    /** Giao dịch chuyển khoản mới khớp yêu cầu thanh toán; trả số thông báo đã gửi (-1 nếu không gửi được). */
    public synchronized int sepayReceipts() {
        if (!repo.sepayEnabled()) {
            return 0;
        }
        record Row(Item item, Instant receivedAt) {
        }
        List<Row> rows = repo.matchedTransfersSince(sepaySince).stream().map(t -> {
            String amount = String.format("%,.0f", t.amount() == null ? BigDecimal.ZERO : t.amount());
            String gateway = t.gateway();
            String title = "Nhận chuyển khoản " + amount + "đ" + (gateway == null ? "" : " qua " + gateway)
                    + " cho mã thanh toán " + t.paymentCode();
            Item item = new Item("SEPAY_RECEIVED", "sepay:" + t.sepayId(), title,
                    "Nội dung: " + cut(t.content(), 300), null, null, t.branchId(), "sales.perform");
            return new Row(item, t.receivedAt());
        }).toList();
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
        return s == null ? "" : s.length() <= max ? s : s.substring(0, max) + "…";
    }
}
