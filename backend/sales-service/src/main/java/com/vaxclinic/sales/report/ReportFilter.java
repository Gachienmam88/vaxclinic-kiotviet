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
 * Chi nhánh luôn bị giới hạn trong các chi nhánh người dùng được làm việc (claim "branches" của JWT).
 */
public record ReportFilter(Instant from, Instant to, List<UUID> branchIds, UUID customerId, UUID sellerId, UUID createdBy,
                           List<String> methods, List<String> saleModes, String q) {

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
                .addValue("q", q == null || q.isBlank() ? null : "%" + q.trim() + "%");
        return p;
    }

    /** Hóa đơn hoàn thành bán trong kỳ (alias i). */
    String invoiceWhere() {
        return "i.status = 'COMPLETED' and i.sold_at >= :from and i.sold_at < :to and i.branch_id in (:branches)" + invoiceAttrs("i.customer_id");
    }

    /** Phiếu trả hoàn thành trong kỳ (alias r), lọc người bán / phương thức bán theo hóa đơn gốc (alias i). */
    String returnWhere() {
        return "r.status = 'COMPLETED' and r.returned_at >= :from and r.returned_at < :to and r.branch_id in (:branches)"
                + invoiceAttrs("r.customer_id").replace("i.created_by", "r.created_by").replace("i.payment_method", "r.payment_method");
    }

    private String invoiceAttrs(String customerCol) {
        var w = new StringBuilder();
        if (customerId != null) w.append(" and ").append(customerCol).append(" = :customerId");
        if (sellerId != null) w.append(" and coalesce(i.seller_id, i.created_by) = :sellerId");
        if (createdBy != null) w.append(" and i.created_by = :createdBy");
        if (nonEmpty(methods)) w.append(" and i.payment_method in (:methods)");
        if (nonEmpty(saleModes)) w.append(" and i.sale_mode in (:saleModes)");
        return w.toString();
    }

    /** Điều kiện tìm hàng theo mã / tên trên dòng (alias dòng truyền vào). */
    String productMatch(String alias) {
        return q == null || q.isBlank() ? "" : " and (" + alias + ".product_code ilike :q or " + alias + ".product_name ilike :q)";
    }

    private static boolean nonEmpty(List<String> l) {
        return l != null && !l.isEmpty();
    }
}
