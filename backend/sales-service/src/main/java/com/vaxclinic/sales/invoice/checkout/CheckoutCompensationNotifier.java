package com.vaxclinic.sales.invoice.checkout;

import com.vaxclinic.common.notification.NotificationClient;
import com.vaxclinic.common.notification.NotificationClient.Item;
import com.vaxclinic.common.settings.ShopSettings;
import org.springframework.stereotype.Component;

import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Báo "Hộp thư đến" (tab Cảnh báo) khi job đối soát đã hoàn kho cho 1 lần thanh toán không lưu được hóa đơn.
 * Cảnh báo dạng sự kiện (publish, không nằm trong sync nào) → không tự đóng; dedupeKey theo lần thanh toán + round
 * → gửi lại không tạo trùng. Không có hóa đơn nên không gắn mã chứng từ / link. Lỗi gửi chỉ log (NotificationClient).
 */
@Component
public class CheckoutCompensationNotifier {

    static final String TYPE = "CHECKOUT_COMPENSATED";
    private static final String PERMISSION = "sales.perform";
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");

    private final NotificationClient notifications;

    public CheckoutCompensationNotifier(NotificationClient notifications) {
        this.notifications = notifications;
    }

    public boolean compensated(CheckoutAttempt a) {
        return notifications.publish(List.of(item(a)));
    }

    /** updatedAt = lần máy bán hàng gửi thanh toán gần nhất (job chỉ nhận dòng không đổi > 5 phút). */
    static Item item(CheckoutAttempt a) {
        String shortId = a.id().toString().substring(0, 8);
        String partner = a.partnerName() == null || a.partnerName().isBlank() ? "" : " - " + a.partnerName();
        String title = "Thanh toán " + a.docCode() + partner + " không lưu được hóa đơn, đã hoàn kho";
        String body = "Lần thanh toán " + shortId + " lúc " + a.updatedAt().atZone(ShopSettings.ZONE).format(DATE_TIME)
                + " không lưu được hóa đơn — đã hoàn kho tự động. Kiểm tra lại với thu ngân.";
        return new Item(TYPE, "checkout_compensated:" + a.id() + ":" + a.round(), title, body, null, null, a.branchId(),
                PERMISSION);
    }
}
