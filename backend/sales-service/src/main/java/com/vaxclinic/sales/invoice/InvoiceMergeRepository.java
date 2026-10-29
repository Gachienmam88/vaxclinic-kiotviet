package com.vaxclinic.sales.invoice;

import com.vaxclinic.sales.invoice.InvoiceMergeDtos.Row;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * SQL của "Gộp đơn": tìm hóa đơn gộp được + chuyển phiếu thu / phân bổ / lô / đơn đặt hàng sang hóa đơn gộp.
 * Phiếu thu "lạ" = phiếu còn hiệu lực phân bổ vào hóa đơn nhưng không do chính hóa đơn sinh ra (thu nợ, tiền cọc đặt hàng).
 */
@Repository
public class InvoiceMergeRepository {

    private static final String ROW = """
            select i.id, i.code, i.sold_at, i.total, i.paid, i.customer_id, c.code customer_code, i.customer_name,
              exists (select 1 from sales_returns r where r.invoice_id = i.id and r.status = 'COMPLETED') has_return,
              exists (select 1 from shipments sh where sh.invoice_id = i.id and sh.status <> 'CANCELLED') has_shipment,
              (select o.status from customer_orders o where o.id = i.order_id) order_status,
              exists (select 1 from voucher_allocations a join cash_vouchers v on v.id = a.voucher_id
                where a.invoice_id = i.id and v.status = 'PAID'
                  and not (v.source_id = i.id and v.source_type in ('INVOICE', 'INVOICE_EXTRA'))) foreign_payment
            from invoices i left join customers c on c.id = i.customer_id
            """;

    private final NamedParameterJdbcTemplate jdbc;

    public InvoiceMergeRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Hóa đơn chưa hủy của chi nhánh bán từ `since`, mới nhất trước. */
    public List<Row> recent(UUID branchId, Instant since) {
        return jdbc.query(ROW + " where i.branch_id = :branch and i.status = 'COMPLETED' and i.sold_at >= :since"
                        + " order by i.sold_at desc, i.code desc",
                new MapSqlParameterSource("branch", branchId).addValue("since", Timestamp.from(since)), (rs, n) -> row(rs));
    }

    public List<Row> byIds(List<UUID> ids) {
        return jdbc.query(ROW + " where i.id in (:ids) order by i.sold_at, i.code", new MapSqlParameterSource("ids", ids),
                (rs, n) -> row(rs));
    }

    /** Phiếu thu chính (TT{mã}) còn hiệu lực của hóa đơn; null nếu lúc bán không thu tiền bằng phương thức chính. */
    public UUID mainVoucher(UUID invoiceId) {
        var found = jdbc.queryForList("select id from cash_vouchers where source_type = 'INVOICE' and source_id = :id"
                + " and status = 'PAID' limit 1", new MapSqlParameterSource("id", invoiceId), UUID.class);
        return found.isEmpty() ? null : found.get(0);
    }

    /**
     * Chuyển các phiếu thu còn hiệu lực của hóa đơn gốc sang hóa đơn gộp: mainVoucher thành phiếu chính (INVOICE),
     * còn lại thành phiếu thanh toán thêm (INVOICE_EXTRA) → hủy hóa đơn gộp sau này hủy đủ các phiếu. Sổ quỹ không đổi.
     */
    public void moveVouchers(List<UUID> fromIds, UUID toId, UUID mainVoucher) {
        var p = new MapSqlParameterSource("from", fromIds).addValue("to", toId).addValue("main", mainVoucher);
        jdbc.update("""
                update voucher_allocations set invoice_id = :to where invoice_id in (:from)
                  and voucher_id in (select id from cash_vouchers where status = 'PAID')""", p);
        jdbc.update("""
                update cash_vouchers set source_type = case when id = cast(:main as uuid) then 'INVOICE' else 'INVOICE_EXTRA' end,
                  source_id = :to
                where source_id in (:from) and source_type in ('INVOICE', 'INVOICE_EXTRA') and status = 'PAID'""", p);
    }

    /** Lô đã xuất của dòng gốc → dòng mới (trả hàng sau gộp hoàn đúng lô). */
    public void copyLineLots(UUID fromLineId, UUID toLineId) {
        jdbc.update("insert into invoice_line_lots(line_id, lot_number, base_qty) select :to, lot_number, base_qty"
                + " from invoice_line_lots where line_id = :from",
                new MapSqlParameterSource("from", fromLineId).addValue("to", toLineId));
    }

    /** Hóa đơn gốc ghi hóa đơn đã gộp vào; đơn đặt hàng đã tạo hóa đơn gốc trỏ sang hóa đơn gộp. */
    public void markMerged(List<UUID> fromIds, UUID toId) {
        var p = new MapSqlParameterSource("from", fromIds).addValue("to", toId);
        jdbc.update("update invoices set merged_into_id = :to where id in (:from)", p);
        jdbc.update("update customer_orders set invoice_id = :to where invoice_id in (:from)", p);
    }

    private static Row row(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new Row(rs.getObject("id", UUID.class), rs.getString("code"), rs.getTimestamp("sold_at").toInstant(),
                rs.getBigDecimal("total"), rs.getBigDecimal("paid"), rs.getObject("customer_id", UUID.class),
                rs.getString("customer_code"), rs.getString("customer_name"), rs.getBoolean("has_return"),
                rs.getBoolean("has_shipment"), rs.getString("order_status"), rs.getBoolean("foreign_payment"));
    }
}
