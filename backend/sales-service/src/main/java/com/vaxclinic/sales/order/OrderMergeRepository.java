package com.vaxclinic.sales.order;

import com.vaxclinic.sales.order.OrderDtos.MergeCandidate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** SQL của "Gộp đơn" đặt hàng: tìm đơn gộp được + chuyển phiếu thu cọc sang đơn gộp. */
@Repository
public class OrderMergeRepository {

    /** 1 đơn gộp được kèm khách (để nhóm theo khách). */
    public record Row(UUID customerId, String customerCode, String customerName, String customerPhone, MergeCandidate order) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public OrderMergeRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Đơn mở (Phiếu tạm / Đã xác nhận), chưa có / không đang lập hóa đơn, của chi nhánh, tạo từ `since`; cũ nhất trước. */
    public List<Row> open(UUID branchId, Instant since) {
        return jdbc.query("""
                select o.id, o.code, o.ordered_at, o.status, o.total, o.deposit, o.customer_id, c.code customer_code,
                  o.customer_name, c.phone
                from customer_orders o join customers c on c.id = o.customer_id
                where o.branch_id = :branch and o.status in ('DRAFT', 'CONFIRMED') and o.invoice_id is null
                  and o.invoicing_id is null and o.created_at >= :since
                order by o.ordered_at, o.code""",
                new MapSqlParameterSource("branch", branchId).addValue("since", Timestamp.from(since)),
                (rs, n) -> new Row(rs.getObject("customer_id", UUID.class), rs.getString("customer_code"),
                        rs.getString("customer_name"), rs.getString("phone"),
                        new MergeCandidate(rs.getObject("id", UUID.class), rs.getString("code"),
                                rs.getTimestamp("ordered_at").toInstant(), rs.getString("status"), rs.getBigDecimal("total"),
                                rs.getBigDecimal("deposit"))));
    }

    /**
     * Phiếu thu cọc còn hiệu lực của các đơn gốc chuyển sang đơn gộp (nguồn ORDER, source_id = đơn gộp): mã phiếu, số tiền,
     * sổ quỹ, công nợ giữ nguyên. Phiếu đã hủy / phiếu chi ở lại đơn gốc làm lịch sử.
     */
    /** Mã các đơn đang được lập hóa đơn ở máy khác (invoicing_id đã giữ chỗ) — không gộp được. */
    public List<String> beingInvoiced(List<UUID> ids) {
        return jdbc.queryForList("select code from customer_orders where id in (:ids) and invoicing_id is not null order by code",
                new MapSqlParameterSource("ids", ids), String.class);
    }

    public int moveReceipts(List<UUID> fromIds, UUID toId) {
        return jdbc.update("""
                update cash_vouchers set source_id = :to
                where source_type = 'ORDER' and source_id in (:from) and voucher_type = 'RECEIPT' and status = 'PAID'""",
                new MapSqlParameterSource("from", fromIds).addValue("to", toId));
    }
}
