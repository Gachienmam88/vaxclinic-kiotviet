package com.vaxclinic.product.purchase;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.purchase.SupplierDebtDtos.DocAllocation;
import com.vaxclinic.product.purchase.SupplierDebtDtos.DocDetail;
import com.vaxclinic.product.purchase.SupplierDebtDtos.HistoryRow;
import com.vaxclinic.product.purchase.SupplierDebtDtos.LedgerRow;
import com.vaxclinic.product.purchase.SupplierDebtDtos.UnpaidReceipt;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Đọc sổ công nợ NCC: sổ chi tiết + số dư lũy kế, lịch sử nhập/trả, phiếu nhập còn nợ, chi tiết 1 phiếu công nợ. */
@Repository
public class SupplierDebtQueryRepository {

    /** Σ phân bổ (thanh toán + chiết khấu) còn hiệu lực của từng phiếu nhập. */
    static final String SETTLED = """
            (select coalesce(sum(a.amount), 0) from supplier_debt_allocations a join supplier_debt_docs d on d.id = a.doc_id
             where a.receipt_id = r.id and d.status = 'ACTIVE')""";

    private final NamedParameterJdbcTemplate jdbc;

    public SupplierDebtQueryRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Mới nhất trước; balance = nợ cần trả NCC ngay sau phát sinh (lũy kế theo thời gian tăng dần). */
    public List<LedgerRow> ledger(UUID supplierId) {
        return jdbc.query("""
                select doc_id, type, code, t, v, sum(v) over (order by t, ord, c, doc_id rows unbounded preceding) bal
                from (%s) l where l.sid = :id order by t desc, ord desc, c desc, doc_id desc""".formatted(SupplierListRepository.LEDGER),
                new MapSqlParameterSource("id", supplierId),
                (rs, n) -> new LedgerRow(rs.getObject("doc_id", UUID.class), rs.getString("type"), rs.getString("code"),
                        rs.getTimestamp("t").toInstant(), rs.getBigDecimal("v"), rs.getBigDecimal("bal")));
    }

    public List<HistoryRow> history(UUID supplierId) {
        return jdbc.query("""
                select id, 'RECEIPT' kind, code, received_at t, created_by_name, total, status from purchase_receipts
                where supplier_id = :id
                union all
                select id, 'RETURN', code, returned_at, created_by_name, total, status from purchase_returns where supplier_id = :id
                order by t desc""", new MapSqlParameterSource("id", supplierId),
                (rs, n) -> new HistoryRow(rs.getObject("id", UUID.class), rs.getString("kind"), rs.getString("code"),
                        rs.getTimestamp("t").toInstant(), rs.getString("created_by_name"), rs.getBigDecimal("total"),
                        rs.getString("status")));
    }

    /** Phiếu nhập đã hoàn thành còn cần trả, cũ trước (thứ tự tự phân bổ). */
    public List<UnpaidReceipt> unpaid(UUID supplierId) {
        return jdbc.query("""
                select * from (select r.id, r.code, r.received_at, r.total, %s settled from purchase_receipts r
                  where r.supplier_id = :id and r.status = 'COMPLETED') x
                where total > settled order by received_at, code""".formatted(SETTLED), new MapSqlParameterSource("id", supplierId),
                (rs, n) -> new UnpaidReceipt(rs.getObject("id", UUID.class), rs.getString("code"),
                        rs.getTimestamp("received_at").toInstant(), rs.getBigDecimal("total"), rs.getBigDecimal("settled"),
                        rs.getBigDecimal("total").subtract(rs.getBigDecimal("settled"))));
    }

    /** Chi tiết phiếu chi / chiết khấu / điều chỉnh. "Đã chi trước" = phân bổ của phiếu khác còn hiệu lực lập trước phiếu này. */
    public DocDetail doc(UUID docId) {
        var p = new MapSqlParameterSource("id", docId);
        var rows = jdbc.queryForList("""
                select d.*, s.code scode, s.name sname from supplier_debt_docs d join suppliers s on s.id = d.supplier_id
                where d.id = :id""", p);
        if (rows.isEmpty()) {
            throw BusinessException.notFound("SUPPLIER_DOC_NOT_FOUND", "Không tìm thấy phiếu");
        }
        var d = rows.get(0);
        List<DocAllocation> allocations = jdbc.query("""
                select r.id, r.code, r.received_at, r.total, a.amount,
                  (select coalesce(sum(a2.amount), 0) from supplier_debt_allocations a2 join supplier_debt_docs d2 on d2.id = a2.doc_id
                   where a2.receipt_id = r.id and d2.id <> me.id and d2.status = 'ACTIVE'
                     and (d2.occurred_at, d2.created_at) < (me.occurred_at, me.created_at)) before
                from supplier_debt_allocations a join purchase_receipts r on r.id = a.receipt_id
                join supplier_debt_docs me on me.id = a.doc_id
                where a.doc_id = :id order by r.received_at, r.code""", p, (rs, n) -> {
            BigDecimal before = rs.getBigDecimal("before"), amount = rs.getBigDecimal("amount");
            return new DocAllocation(rs.getObject("id", UUID.class), rs.getString("code"),
                    rs.getTimestamp("received_at").toInstant(), rs.getBigDecimal("total"), before, amount,
                    before.add(amount).compareTo(rs.getBigDecimal("total")) >= 0);
        });
        BigDecimal amount = (BigDecimal) d.get("amount");
        BigDecimal allocated = allocations.stream().map(DocAllocation::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        return new DocDetail(docId, (String) d.get("code"), (String) d.get("kind"), (String) d.get("status"),
                (UUID) d.get("supplier_id"), (String) d.get("scode"), (String) d.get("sname"), (UUID) d.get("branch_id"),
                ((java.sql.Timestamp) d.get("occurred_at")).toInstant(), amount, (String) d.get("payment_method"),
                (UUID) d.get("bank_account_id"), (UUID) d.get("staff_id"), (String) d.get("staff_name"),
                (String) d.get("created_by_name"), (String) d.get("note"), (UUID) d.get("receipt_id"), allocations,
                "ADJUSTMENT".equals(d.get("kind")) || "REFUND".equals(d.get("kind")) ? BigDecimal.ZERO : amount.subtract(allocated));
    }
}
