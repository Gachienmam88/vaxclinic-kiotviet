package com.vaxclinic.integration.storeprofile;

import com.vaxclinic.common.notification.NotificationClient;
import com.vaxclinic.common.notification.NotificationClient.Item;
import com.vaxclinic.common.settings.ShopSettings;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * Cảnh báo "Chữ ký số sắp hết hạn" (Hộp thư đến → Cảnh báo, quyền settings.manage): chữ ký số đang hoạt động, chưa thu hồi,
 * hết hạn trong {@value #DAYS} ngày tới hoặc đã hết hạn. Đồng bộ trọn bộ loại CERT_EXPIRING (identity tự đóng cảnh báo
 * không còn đúng) mỗi 6 giờ và ngay sau mỗi lần thêm / sửa / xóa chữ ký số.
 */
@Component
public class CertificateExpiryAlerts {

    static final String TYPE = "CERT_EXPIRING";
    static final int DAYS = 30;
    private static final Logger log = LoggerFactory.getLogger(CertificateExpiryAlerts.class);
    private static final DateTimeFormatter DMY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final DigitalCertificateRepository certificates;
    private final NotificationClient notifications;

    public CertificateExpiryAlerts(DigitalCertificateRepository certificates, NotificationClient notifications) {
        this.certificates = certificates;
        this.notifications = notifications;
    }

    @Scheduled(initialDelay = 70_000, fixedDelay = 6 * 3600_000)
    public void syncQuietly() {
        try {
            sync();
        } catch (RuntimeException e) {
            log.warn("Certificate expiry alert job failed: {}", e.getMessage());
        }
    }

    /** Trả số cảnh báo đang đúng (-1 nếu không gửi được tới identity-service). */
    public synchronized int sync() {
        LocalDate today = LocalDate.now(ShopSettings.ZONE);
        List<Item> items = certificates.findActiveExpiringBy(today.plusDays(DAYS)).stream().map(c -> {
            LocalDate exp = c.expiresOn();
            long left = ChronoUnit.DAYS.between(today, exp);
            String title = left < 0 ? "Chữ ký số " + c.subjectName() + " đã hết hạn ngày " + exp.format(DMY)
                    : "Chữ ký số " + c.subjectName() + " sắp hết hạn ngày " + exp.format(DMY) + " (còn " + left + " ngày)";
            String body = (c.serialNumber() == null ? "" : "Số serial " + c.serialNumber() + ". ")
                    + "Gia hạn chứng thư số với nhà cung cấp để không gián đoạn phát hành hóa đơn điện tử.";
            return new Item(TYPE, "cert_expiring:" + c.id(), title, body, null,
                    "/store-profile/certificates", null, "settings.manage");
        }).toList();
        return notifications.sync(List.of(TYPE), items) ? items.size() : -1;
    }
}
