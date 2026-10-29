package com.vaxclinic.sales.delivery;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Trạng thái vận đơn (như KiotViet) và các bước chuyển hợp lệ. Trạng thái trung gian (Đã lấy hàng, Chờ lấy lại, Chờ giao lại,
 * Chờ chuyển hoàn, Chờ chuyển hoàn lại) chỉ đổi trạng thái + ghi lịch sử — sổ đối tác / công nợ chỉ ghi ở Giao thành công,
 * Đã chuyển hoàn, Đã hủy (ShipmentStatusWriter). Đã hủy chỉ khi chưa lấy hàng (Chờ xử lý / Đang lấy hàng / Chờ lấy lại).
 * Giao thành công, Đã chuyển hoàn, Đã hủy là trạng thái cuối.
 */
public final class ShipmentStatus {

    public static final String PENDING = "PENDING";
    public static final String PICKING = "PICKING";
    public static final String PICKED = "PICKED";
    public static final String WAIT_REPICK = "WAIT_REPICK";
    public static final String DELIVERING = "DELIVERING";
    public static final String WAIT_REDELIVER = "WAIT_REDELIVER";
    public static final String DELIVERED = "DELIVERED";
    public static final String WAIT_RETURN = "WAIT_RETURN";
    public static final String RETURNING = "RETURNING";
    public static final String WAIT_RERETURN = "WAIT_RERETURN";
    public static final String RETURNED = "RETURNED";
    public static final String CANCELLED = "CANCELLED";
    public static final String PATTERN = "PENDING|PICKING|PICKED|WAIT_REPICK|DELIVERING|WAIT_REDELIVER|DELIVERED|WAIT_RETURN"
            + "|RETURNING|WAIT_RERETURN|RETURNED|CANCELLED";

    /** Thứ tự hiển thị như KiotViet. */
    public static final Map<String, String> LABELS = labels();

    /** Đang trên đường chuyển hoàn (chưa nhận lại hàng) — chưa tính là "cần thu hộ". */
    public static final List<String> RETURN_FLOW = List.of(WAIT_RETURN, RETURNING, WAIT_RERETURN, RETURNED);

    private static final Map<String, Set<String>> NEXT = Map.of(
            PENDING, Set.of(PICKING, PICKED, DELIVERING, DELIVERED, CANCELLED),
            PICKING, Set.of(PICKED, WAIT_REPICK, DELIVERING, DELIVERED, CANCELLED),
            WAIT_REPICK, Set.of(PICKING, PICKED, CANCELLED),
            PICKED, Set.of(DELIVERING, DELIVERED),
            DELIVERING, Set.of(DELIVERED, WAIT_REDELIVER, WAIT_RETURN, RETURNING, RETURNED),
            WAIT_REDELIVER, Set.of(DELIVERING, DELIVERED, WAIT_RETURN, RETURNING, RETURNED),
            WAIT_RETURN, Set.of(DELIVERING, RETURNING, RETURNED),
            RETURNING, Set.of(WAIT_RERETURN, RETURNED),
            WAIT_RERETURN, Set.of(RETURNING, RETURNED));

    private ShipmentStatus() {
    }

    private static Map<String, String> labels() {
        var m = new LinkedHashMap<String, String>();
        m.put(PENDING, "Chờ xử lý");
        m.put(PICKING, "Đang lấy hàng");
        m.put(PICKED, "Đã lấy hàng");
        m.put(WAIT_REPICK, "Chờ lấy lại");
        m.put(DELIVERING, "Đang giao hàng");
        m.put(WAIT_REDELIVER, "Chờ giao lại");
        m.put(DELIVERED, "Giao thành công");
        m.put(WAIT_RETURN, "Chờ chuyển hoàn");
        m.put(RETURNING, "Đang chuyển hoàn");
        m.put(WAIT_RERETURN, "Chờ chuyển hoàn lại");
        m.put(RETURNED, "Đã chuyển hoàn");
        m.put(CANCELLED, "Đã hủy");
        return java.util.Collections.unmodifiableMap(m);
    }

    public static boolean canMove(String from, String to) {
        return NEXT.getOrDefault(from, Set.of()).contains(to);
    }

    /** Chưa lấy hàng: được sửa thông tin giao / sửa hóa đơn / hủy. */
    public static boolean beforePickup(String status) {
        return PENDING.equals(status) || PICKING.equals(status) || WAIT_REPICK.equals(status);
    }

    public static boolean returning(String status) {
        return RETURN_FLOW.contains(status);
    }

    public static String label(String status) {
        return LABELS.getOrDefault(status, status);
    }
}
