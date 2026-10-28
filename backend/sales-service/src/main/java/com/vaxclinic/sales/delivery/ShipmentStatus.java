package com.vaxclinic.sales.delivery;

import java.util.Map;
import java.util.Set;

/**
 * Trạng thái vận đơn (như KiotViet) và các bước chuyển hợp lệ.
 * Đã hủy chỉ khi chưa lấy hàng (Chờ xử lý / Đang lấy hàng). Giao thành công, Đã chuyển hoàn, Đã hủy là trạng thái cuối.
 */
public final class ShipmentStatus {

    public static final String PENDING = "PENDING";
    public static final String PICKING = "PICKING";
    public static final String DELIVERING = "DELIVERING";
    public static final String DELIVERED = "DELIVERED";
    public static final String RETURNING = "RETURNING";
    public static final String RETURNED = "RETURNED";
    public static final String CANCELLED = "CANCELLED";
    public static final String PATTERN = "PENDING|PICKING|DELIVERING|DELIVERED|RETURNING|RETURNED|CANCELLED";

    public static final Map<String, String> LABELS = Map.of(PENDING, "Chờ xử lý", PICKING, "Đang lấy hàng",
            DELIVERING, "Đang giao hàng", DELIVERED, "Giao thành công", RETURNING, "Chuyển hoàn",
            RETURNED, "Đã chuyển hoàn", CANCELLED, "Đã hủy");

    private static final Map<String, Set<String>> NEXT = Map.of(
            PENDING, Set.of(PICKING, DELIVERING, DELIVERED, CANCELLED),
            PICKING, Set.of(DELIVERING, DELIVERED, CANCELLED),
            DELIVERING, Set.of(DELIVERED, RETURNING, RETURNED),
            RETURNING, Set.of(RETURNED));

    private ShipmentStatus() {
    }

    public static boolean canMove(String from, String to) {
        return NEXT.getOrDefault(from, Set.of()).contains(to);
    }

    /** Chưa lấy hàng: được sửa thông tin giao / sửa hóa đơn / hủy. */
    public static boolean beforePickup(String status) {
        return PENDING.equals(status) || PICKING.equals(status);
    }

    public static boolean returning(String status) {
        return RETURNING.equals(status) || RETURNED.equals(status);
    }

    public static String label(String status) {
        return LABELS.getOrDefault(status, status);
    }
}
