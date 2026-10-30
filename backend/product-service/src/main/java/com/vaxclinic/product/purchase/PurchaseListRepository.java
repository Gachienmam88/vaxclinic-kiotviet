package com.vaxclinic.product.purchase;

import com.vaxclinic.product.purchase.PurchaseDtos.ListTotals;
import com.vaxclinic.product.purchase.PurchaseDtos.ReceiptListItem;
import com.vaxclinic.product.purchase.PurchaseDtos.ReceiptListResponse;
import com.vaxclinic.product.purchase.PurchaseDtos.ReturnListItem;
import com.vaxclinic.product.purchase.PurchaseDtos.ReturnListResponse;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Danh sách phiếu nhập / trả hàng nhập với bộ lọc bên trái + dòng tổng. */
@Repository
public class PurchaseListRepository {

    public record Filter(String q, List<String> statuses, Instant from, Instant to, UUID createdBy, UUID personId,
                         String inputInvoiceNo, UUID supplierId, UUID branchId, int page, int size, List<UUID> branches) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public PurchaseListRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public ReceiptListResponse receipts(Filter f) {
        var p = new MapSqlParameterSource();
        String where = where(f, p, "r.received_at", "r.receiver_id")
                + (blank(f.inputInvoiceNo()) ? "" : " and r.input_invoice_no ilike :invoiceNo");
        p.addValue("invoiceNo", "%" + (f.inputInvoiceNo() == null ? "" : f.inputInvoiceNo().trim()) + "%");
        String from = " from purchase_receipts r left join suppliers s on s.id = r.supplier_id" + where;
        Map<String, Object> agg = jdbc.queryForMap("select count(*) cnt, coalesce(sum(r.subtotal),0) sub,"
                + " coalesce(sum(r.discount),0) disc, coalesce(sum(r.vat_amount),0) vat, coalesce(sum(r.total),0) tot,"
                + " coalesce(sum(r.paid_amount),0) paid" + from, p);
        page(f, p);
        var items = jdbc.query("select r.*, s.code supplier_code, s.name supplier_name" + from
                + " order by r.received_at desc limit :limit offset :offset", p, (rs, i) -> new ReceiptListItem(
                rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("status"),
                rs.getTimestamp("received_at").toInstant(), rs.getString("supplier_code"), rs.getString("supplier_name"),
                rs.getString("input_invoice_no"), rs.getString("created_by_name"), rs.getString("receiver_name"),
                rs.getBigDecimal("subtotal"), rs.getBigDecimal("discount"), rs.getBigDecimal("vat_amount"),
                rs.getBigDecimal("total"), rs.getBigDecimal("paid_amount")));
        return new ReceiptListResponse(items, count(agg), f.page(), f.size(), sums(agg));
    }

    public ReturnListResponse returns(Filter f) {
        var p = new MapSqlParameterSource();
        String from = " from purchase_returns r left join suppliers s on s.id = r.supplier_id"
                + " left join purchase_receipts pr on pr.id = r.receipt_id" + where(f, p, "r.returned_at", "r.returner_id");
        Map<String, Object> agg = jdbc.queryForMap("select count(*) cnt, coalesce(sum(r.subtotal),0) sub,"
                + " coalesce(sum(r.discount),0) disc, coalesce(sum(r.vat_amount),0) vat, coalesce(sum(r.total),0) tot,"
                + " coalesce(sum(r.refund_amount),0) paid" + from, p);
        page(f, p);
        var items = jdbc.query("select r.*, s.name supplier_name, s.code supplier_code, pr.code receipt_code" + from
                + " order by r.returned_at desc limit :limit offset :offset", p, (rs, i) -> new ReturnListItem(
                rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("status"),
                rs.getTimestamp("returned_at").toInstant(), rs.getString("supplier_name"), rs.getString("receipt_code"),
                rs.getString("returner_name"), rs.getBigDecimal("subtotal"), rs.getBigDecimal("discount"),
                rs.getBigDecimal("vat_amount"), rs.getBigDecimal("total"), rs.getBigDecimal("refund_amount"),
                rs.getObject("receipt_id", UUID.class), rs.getString("created_by_name"), rs.getObject("branch_id", UUID.class),
                rs.getString("note"), rs.getString("supplier_code")));
        return new ReturnListResponse(items, count(agg), f.page(), f.size(), sums(agg));
    }

    /** Điều kiện chung; mọi đoạn bắt đầu bằng khoảng trắng để nối chuỗi an toàn. */
    private static String where(Filter f, MapSqlParameterSource p, String timeCol, String personCol) {
        var w = new StringBuilder(" where 1=1");
        if (!blank(f.q())) {
            w.append(" and r.code ilike :q");
            p.addValue("q", "%" + f.q().trim() + "%");
        }
        if (f.statuses() != null && !f.statuses().isEmpty()) {
            w.append(" and r.status in (:statuses)");
            p.addValue("statuses", f.statuses());
        }
        if (f.from() != null) {
            w.append(" and ").append(timeCol).append(" >= :from");
            p.addValue("from", Timestamp.from(f.from()));
        }
        if (f.to() != null) {
            w.append(" and ").append(timeCol).append(" < :to");
            p.addValue("to", Timestamp.from(f.to()));
        }
        if (f.createdBy() != null) {
            w.append(" and r.created_by = :createdBy");
            p.addValue("createdBy", f.createdBy());
        }
        if (f.personId() != null) {
            w.append(" and ").append(personCol).append(" = :personId");
            p.addValue("personId", f.personId());
        }
        if (f.supplierId() != null) {
            w.append(" and r.supplier_id = :supplierId");
            p.addValue("supplierId", f.supplierId());
        }
        w.append(" and r.branch_id in (:branches)"); // chỉ chi nhánh người dùng được xem
        p.addValue("branches", f.branches());
        if (f.branchId() != null) {
            w.append(" and r.branch_id = :branchId");
            p.addValue("branchId", f.branchId());
        }
        return w.toString();
    }

    private static void page(Filter f, MapSqlParameterSource p) {
        p.addValue("limit", f.size()).addValue("offset", (long) f.page() * f.size());
    }

    private static long count(Map<String, Object> agg) {
        return ((Number) agg.get("cnt")).longValue();
    }

    private static ListTotals sums(Map<String, Object> agg) {
        return new ListTotals((BigDecimal) agg.get("sub"), (BigDecimal) agg.get("disc"), (BigDecimal) agg.get("vat"),
                (BigDecimal) agg.get("tot"), (BigDecimal) agg.get("paid"));
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
