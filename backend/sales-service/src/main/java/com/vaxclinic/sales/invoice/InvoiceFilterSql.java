package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.search.AccentInsensitiveSql;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Mệnh đề where của danh sách hóa đơn (sidebar lọc kiểu KiotViet). Bảng gốc: invoices i, customers c,
 * lateral s = vận đơn đang hoạt động (chưa hủy) mới nhất của hóa đơn.
 */
final class InvoiceFilterSql {

    /** Bảng nguồn chung cho đếm + trang dữ liệu. */
    static final String FROM = " from invoices i left join customers c on c.id = i.customer_id"
            + " left join lateral (select sh.status from shipments sh where sh.invoice_id = i.id and sh.status <> 'CANCELLED'"
            + " order by sh.created_at desc limit 1) s on true where 1=1";

    /**
     * Trạng thái hiển thị như KiotViet: Đã hủy; vận đơn chuyển hoàn → Không giao được; vận đơn chưa giao xong → Đang xử lý;
     * còn lại (bán thường / giao thành công) → Hoàn thành.
     */
    static final String STATE = "(case when i.status = 'CANCELLED' then 'CANCELLED'"
            + " when s.status in ('RETURNING','RETURNED') then 'FAILED_DELIVERY'"
            + " when s.status in ('PENDING','PICKING','DELIVERING') then 'PROCESSING' else 'COMPLETED' end)";

    static final String HAS_RETURN = "exists (select 1 from sales_returns r where r.invoice_id = i.id and r.status = 'COMPLETED')";

    /** Trạng thái HĐĐT do integration-service phân loại (ACCEPTED = đã có mã CQT). */
    static final List<String> EINVOICE_STATES = List.of("PUBLISHED", "ACCEPTED", "FAILED");

    private InvoiceFilterSql() {
    }

    /**
     * @param einvoices invoice id theo trạng thái HĐĐT (PUBLISHED / ACCEPTED / FAILED); chỉ cần khi lọc theo HĐĐT,
     *                  null = không lọc HĐĐT.
     */
    static String where(InvoiceQuery.Filter f, MapSqlParameterSource p, Map<String, List<UUID>> einvoices) {
        var w = new StringBuilder(FROM);
        like(w, p, f.q(), "q", " and (i.code ilike :q or " + AccentInsensitiveSql.like("i.customer_name", ":q") + " or c.code ilike :q or c.phone ilike :q)");
        like(w, p, f.customerQ(), "customerQ", " and (" + AccentInsensitiveSql.like("i.customer_name", ":customerQ") + " or c.code ilike :customerQ or c.phone ilike :customerQ)");
        like(w, p, f.productQ(), "productQ", " and exists (select 1 from invoice_lines l where l.invoice_id = i.id"
                + " and (l.product_code ilike :productQ or l.product_name ilike :productQ))");
        like(w, p, f.noteQ(), "noteQ", " and i.note ilike :noteQ");
        add(w, p, notEmpty(f.ids()), " and i.id in (:ids)", "ids", f.ids());
        add(w, p, notEmpty(f.statuses()), " and i.status in (:statuses)", "statuses", f.statuses());
        add(w, p, notEmpty(f.states()), " and " + STATE + " in (:states)", "states", f.states());
        add(w, p, f.from() != null, " and i.sold_at >= :from", "from", ts(f.from()));
        add(w, p, f.to() != null, " and i.sold_at < :to", "to", ts(f.to()));
        add(w, p, f.createdBy() != null, " and i.created_by = :createdBy", "createdBy", f.createdBy());
        add(w, p, f.sellerId() != null, " and i.seller_id = :sellerId", "sellerId", f.sellerId());
        add(w, p, notEmpty(f.paymentMethods()), " and i.payment_method in (:methods)", "methods", f.paymentMethods());
        add(w, p, f.customerId() != null, " and i.customer_id = :customerId", "customerId", f.customerId());
        add(w, p, f.branchId() != null, " and i.branch_id = :branchId", "branchId", f.branchId());
        // Giao hàng / Không giao hàng: chọn cả hai (hoặc không chọn) = không lọc
        w.append(either(f.deliveries(), "DELIVERY", "NONE", "i.sale_mode = 'DELIVERY'"));
        w.append(either(f.returnStates(), "HAS", "NONE", HAS_RETURN));
        if (notEmpty(f.einvoiceStatuses()) && einvoices != null) {
            w.append(einvoiceClause(f.einvoiceStatuses(), einvoices, p));
        }
        if (notEmpty(f.einvoiceNatures())) {
            // Hệ thống chỉ phát hành hóa đơn gốc (chưa có điều chỉnh / thay thế) → Gốc = đã phát hành HĐĐT
            var published = new ArrayList<UUID>(einvoices == null ? List.of() : einvoices.getOrDefault("PUBLISHED", List.of()));
            if (einvoices != null) {
                published.addAll(einvoices.getOrDefault("ACCEPTED", List.of()));
            }
            w.append(f.einvoiceNatures().contains("ORIGINAL") ? inList("i.id", published, "ei_nature", p) : " and false");
        }
        return w.toString();
    }

    /** Lọc HĐĐT: NONE = chưa có bản ghi phát hành nào; các trạng thái khác theo danh sách id integration-service trả về. */
    static String einvoiceClause(List<String> statuses, Map<String, List<UUID>> ids, MapSqlParameterSource p) {
        var parts = new ArrayList<String>();
        for (String st : statuses) {
            if ("NONE".equals(st)) {
                var all = ids.values().stream().flatMap(List::stream).toList();
                parts.add(all.isEmpty() ? "true" : "i.id not in (:ei_all)");
                p.addValue("ei_all", all);
            } else if (EINVOICE_STATES.contains(st)) {
                var list = ids.getOrDefault(st, List.of());
                String name = "ei_" + st.toLowerCase();
                parts.add(list.isEmpty() ? "false" : "i.id in (:" + name + ")");
                p.addValue(name, list);
            }
        }
        return parts.isEmpty() ? "" : " and (" + String.join(" or ", parts) + ")";
    }

    /** Bộ lọc 2 lựa chọn (có / không): chỉ chọn 1 trong 2 mới thêm điều kiện. */
    static String either(List<String> chosen, String yes, String no, String condition) {
        if (chosen == null) {
            return "";
        }
        boolean y = chosen.contains(yes);
        boolean n = chosen.contains(no);
        if (y == n) {
            return "";
        }
        return y ? " and " + condition : " and not " + condition;
    }

    private static String inList(String col, List<UUID> ids, String name, MapSqlParameterSource p) {
        if (ids.isEmpty()) {
            return " and false";
        }
        p.addValue(name, ids);
        return " and " + col + " in (:" + name + ")";
    }

    private static void like(StringBuilder w, MapSqlParameterSource p, String value, String name, String sql) {
        if (value != null && !value.isBlank()) {
            w.append(sql);
            p.addValue(name, "%" + value.trim() + "%");
        }
    }

    private static void add(StringBuilder w, MapSqlParameterSource p, boolean when, String sql, String name, Object value) {
        if (when) {
            w.append(sql);
            p.addValue(name, value);
        }
    }

    private static boolean notEmpty(List<?> list) {
        return list != null && !list.isEmpty();
    }

    private static Timestamp ts(Instant t) {
        return t == null ? null : Timestamp.from(t);
    }
}
