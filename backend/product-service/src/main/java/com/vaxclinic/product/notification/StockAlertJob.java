package com.vaxclinic.product.notification;

import com.vaxclinic.common.notification.NotificationClient;
import com.vaxclinic.common.notification.NotificationClient.Item;
import com.vaxclinic.common.settings.ShopSettings;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Cảnh báo kho cho Hộp thư đến (mỗi 15 phút + sau khi khởi động), theo từng chi nhánh, quyền inventory.view:
 * - LOT_EXPIRING: lô còn tồn sắp hết hạn trong N ngày (Thiết lập → Thông báo nội bộ, mặc định 30);
 * - LOT_EXPIRED: lô đã hết hạn nhưng vẫn còn tồn;
 * - LOW_STOCK: hàng đang kinh doanh có tồn dưới định mức tồn tối thiểu (products.min_stock).
 * Gửi trọn bộ mỗi lần → identity tự đóng cảnh báo không còn đúng (lô đã xuất hết, đã nhập thêm hàng...).
 */
@Component
public class StockAlertJob {

    static final List<String> TYPES = List.of("LOT_EXPIRING", "LOT_EXPIRED", "LOW_STOCK");
    private static final String PERMISSION = "inventory.view";
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final Logger log = LoggerFactory.getLogger(StockAlertJob.class);

    private final JdbcTemplate jdbc;
    private final NotificationClient notifications;

    public StockAlertJob(JdbcTemplate jdbc, NotificationClient notifications) {
        this.jdbc = jdbc;
        this.notifications = notifications;
    }

    @Scheduled(initialDelay = 45_000, fixedDelay = 15 * 60_000)
    public void scheduled() {
        try {
            run();
        } catch (RuntimeException e) {
            log.warn("Stock alert job failed: {}", e.getMessage());
        }
    }

    /** Chạy ngay; trả số cảnh báo đang đúng đã gửi (-1 nếu không gửi được sang identity-service). */
    public synchronized int run() {
        LocalDate today = LocalDate.now(ShopSettings.ZONE);
        int days = notifications.settings().expiryAlertDays();
        List<Item> items = new ArrayList<>(lotAlerts(today, days));
        items.addAll(lowStockAlerts());
        return notifications.sync(TYPES, items) ? items.size() : -1;
    }

    private List<Item> lotAlerts(LocalDate today, int days) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select l.id, l.branch_id, l.lot_number, l.expiry_date, l.quantity, p.name, u.code
                from product_lots l join products p on p.id = l.product_id
                join product_units u on u.product_id = p.id and u.is_base
                where l.quantity > 0 and not p.deleted and l.expiry_date <= ?""", Date.valueOf(today.plusDays(days)));
        List<Item> items = new ArrayList<>();
        for (var r : rows) {
            LocalDate expiry = ((Date) r.get("expiry_date")).toLocalDate();
            String product = r.get("name") + " (" + r.get("code") + ")";
            String qty = qty((BigDecimal) r.get("quantity"));
            boolean expired = expiry.isBefore(today);
            long left = ChronoUnit.DAYS.between(today, expiry);
            String title = expired
                    ? "Lô " + r.get("lot_number") + " - " + product + " đã hết hạn nhưng còn tồn " + qty
                    : "Lô " + r.get("lot_number") + " - " + product + (left == 0 ? " hết hạn hôm nay" : " còn " + left + " ngày hết hạn");
            String body = "Hạn sử dụng " + expiry.format(DATE) + ", tồn " + qty + ". "
                    + (expired ? "Xuất hủy lô hết hạn để số tồn kho đúng thực tế." : "Ưu tiên sử dụng trước hoặc trả nhà cung cấp.");
            String type = expired ? "LOT_EXPIRED" : "LOT_EXPIRING";
            items.add(new Item(type, type.toLowerCase() + ":" + r.get("id"), title, body, (String) r.get("code"), null,
                    (UUID) r.get("branch_id"), PERMISSION));
        }
        return items;
    }

    /** Chi nhánh = các chi nhánh đã từng có tồn; hàng chưa có dòng tồn ở chi nhánh đó tính tồn 0. */
    private List<Item> lowStockAlerts() {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select p.id, b.branch_id, coalesce(sb.quantity, 0) as quantity, p.min_stock, p.name, u.code
                from products p join product_units u on u.product_id = p.id and u.is_base
                cross join (select distinct branch_id from stock_balances) b
                left join stock_balances sb on sb.product_id = p.id and sb.branch_id = b.branch_id
                where not p.deleted and p.active and p.min_stock > 0 and coalesce(sb.quantity, 0) < p.min_stock""");
        List<Item> items = new ArrayList<>();
        for (var r : rows) {
            String title = "Hàng " + r.get("name") + " (" + r.get("code") + ") dưới định mức tồn tối thiểu";
            String body = "Tồn kho " + qty((BigDecimal) r.get("quantity")) + ", định mức tối thiểu "
                    + qty((BigDecimal) r.get("min_stock")) + ". Cần nhập thêm hàng.";
            items.add(new Item("LOW_STOCK", "low_stock:" + r.get("id") + ":" + r.get("branch_id"), title, body,
                    (String) r.get("code"), null, (UUID) r.get("branch_id"), PERMISSION));
        }
        return items;
    }

    private static String qty(BigDecimal v) {
        return v == null ? "0" : v.stripTrailingZeros().toPlainString();
    }
}
