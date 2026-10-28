package com.vaxclinic.sales.report;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Bộ lọc chung của các báo cáo bán hàng (query string): khoảng thời gian [from, to), chi nhánh, khách, người bán,
 * người tạo, phương thức thanh toán (CASH/TRANSFER/CARD/EWALLET), phương thức bán hàng (QUICK/NORMAL/DELIVERY), tìm hàng.
 * Bảng giá: priceBookIds (UUID 0 = "Bảng giá chung"); kênh bán: channels (mã sales_channels);
 * thời gian giao hàng của đơn đặt hàng: [deliveryFrom, deliveryTo).
 * Chi nhánh luôn bị giới hạn trong các chi nhánh người dùng được làm việc (claim "branches" của JWT).
 */
public record ReportFilter(Instant from, Instant to, List<UUID> branchIds, UUID customerId, UUID sellerId, UUID createdBy,
                           List<String> methods, List<String> saleModes, String q, List<UUID> priceBookIds,
                           List<String> channels, Instant deliveryFrom, Instant deliveryTo) {

    /** Mã "Bảng giá chung" (hóa đơn / đơn không áp bảng giá nào). */
    public static final UUID GENERAL_PRICE_BOOK = new UUID(0, 0);

    /** Tên múi giờ dùng để cắt ngày / tháng trong SQL. */
    static final String TZ = "'Asia/Ho_Chi_Minh'";

    /** Tham số SQL: from, to, branches (đã giao với chi nhánh của người dùng) + các bộ lọc không rỗng. */
    MapSqlParameterSource params(Actor actor) {
        if (from == null || to == null || !from.isBefore(to)) {
            throw BusinessException.badRequest("REPORT_RANGE_INVALID", "Khoảng thời gian báo cáo không hợp lệ");
        }
        List<UUID> allowed = actor.branchIds().stream().map(UUID::fromString).toList();
        List<UUID> branches = branchIds == null || branchIds.isEmpty() ? allowed
                : branchIds.stream().filter(allowed::contains).toList();
        var p = new MapSqlParameterSource()
                .addValue("from", Timestamp.from(from)).addValue("to", Timestamp.from(to))
                // Danh sách rỗng → "in ()" sai cú pháp: thay bằng 1 id giả (không khớp dòng nào)
                .addValue("branches", branches.isEmpty() ? List.of(new UUID(0, 0)) : branches)
                .addValue("customerId", customerId).addValue("sellerId", sellerId).addValue("createdBy", createdBy)
                .addValue("methods", nonEmpty(methods) ? methods : List.of("-"))
                .addValue("saleModes", nonEmpty(saleModes) ? saleModes : List.of("-"))
                .addValue("q", q == null || q.isBlank() ? null : "%" + q.trim() + "%")
                .addValue("priceBooks", priceBookIds != null && !priceBookIds.isEmpty() ? priceBookIds : List.of(GENERAL_PRICE_BOOK))
                .addValue("channels", nonEmpty(channels) ? channels : List.of("-"))
                .addValue("deliveryFrom", deliveryFrom == null ? null : Timestamp.from(deliveryFrom))
                .addValue("deliveryTo", deliveryTo == null ? null : Timestamp.from(deliveryTo));
        return p;
    }

    /** Hóa đơn hoàn thành bán trong kỳ (alias i). */
    String invoiceWhere() {
        return "i.status = 'COMPLETED' and i.sold_at >= :from and i.sold_at < :to and i.branch_id in (:branches)" + invoiceAttrs("i.customer_id", "i.created_by", "i.payment_method");
    }

    /**
     * Phiếu trả hoàn thành trong kỳ (alias r), lọc người bán / phương thức bán / bảng giá / kênh bán theo hóa đơn gốc
     * (alias i, LEFT JOIN). Phiếu "Trả nhanh" không có hóa đơn (i null) nên bị loại khi lọc theo các tiêu chí đó.
     */
    String returnWhere() {
        return "r.status = 'COMPLETED' and r.returned_at >= :from and r.returned_at < :to and r.branch_id in (:branches)"
                + invoiceAttrs("r.customer_id", "r.created_by", "r.payment_method");
    }

    private String invoiceAttrs(String customerCol, String creatorCol, String methodCol) {
        var w = new StringBuilder();
        if (customerId != null) w.append(" and ").append(customerCol).append(" = :customerId");
        if (sellerId != null) w.append(" and coalesce(i.seller_id, i.created_by) = :sellerId");
        if (createdBy != null) w.append(" and ").append(creatorCol).append(" = :createdBy");
        if (nonEmpty(methods)) w.append(" and ").append(methodCol).append(" in (:methods)");
        if (nonEmpty(saleModes)) w.append(" and i.sale_mode in (:saleModes)");
        w.append(docMeta("i"));
        return w.toString();
    }

    /** Bộ lọc bảng giá + kênh bán trên chứng từ (alias hóa đơn hoặc đơn đặt hàng). */
    String docMeta(String alias) {
        var w = new StringBuilder();
        if (priceBookIds != null && !priceBookIds.isEmpty()) {
            w.append(" and coalesce(").append(alias).append(".price_book_id, '00000000-0000-0000-0000-000000000000'::uuid) in (:priceBooks)");
        }
        if (nonEmpty(channels)) w.append(" and ").append(alias).append(".sales_channel in (:channels)");
        return w.toString();
    }

    /** Thời gian giao hàng của đơn đặt hàng (alias o). */
    String deliveryWhere() {
        return (deliveryFrom == null ? "" : " and o.expected_delivery_at >= :deliveryFrom")
                + (deliveryTo == null ? "" : " and o.expected_delivery_at < :deliveryTo");
    }

    /** Điều kiện tìm hàng theo mã / tên trên dòng (alias dòng truyền vào). */
    String productMatch(String alias) {
        return q == null || q.isBlank() ? "" : " and (" + alias + ".product_code ilike :q or " + alias + ".product_name ilike :q)";
    }

    private static boolean nonEmpty(List<String> l) {
        return l != null && !l.isEmpty();
    }
}
