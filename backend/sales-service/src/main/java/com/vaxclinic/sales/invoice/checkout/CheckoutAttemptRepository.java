package com.vaxclinic.sales.invoice.checkout;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Truy cập bảng checkout_attempts (chỉ SQL, không quy tắc nghiệp vụ — xem CheckoutAttemptRules). */
@Repository
public class CheckoutAttemptRepository {

    private static final RowMapper<CheckoutAttempt> ROW = (rs, i) -> new CheckoutAttempt(
            rs.getObject("id", UUID.class), rs.getObject("stock_doc_id", UUID.class), rs.getInt("round"),
            rs.getString("status"), rs.getObject("branch_id", UUID.class), rs.getString("doc_code"),
            rs.getString("partner_name"), rs.getObject("user_id", UUID.class), rs.getTimestamp("updated_at").toInstant());

    private final JdbcTemplate jdbc;

    public CheckoutAttemptRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Khóa dòng (FOR UPDATE) trong transaction hiện tại; null = chưa có. */
    public CheckoutAttempt lock(UUID id) {
        List<CheckoutAttempt> rows = jdbc.query("select * from checkout_attempts where id = ? for update", ROW, id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** Chèn dòng PENDING nếu chưa có; true = vừa chèn (2 lần gửi song song: lần sau nhận false, không lỗi). */
    public boolean insertIfAbsent(UUID id, UUID branchId) {
        return 1 == jdbc.update("""
                insert into checkout_attempts(id, stock_doc_id, status, branch_id, doc_code, payload_hash, summary)
                values (?, ?, 'PENDING', ?, '', '', '') on conflict (id) do nothing""", id, id, branchId);
    }

    /** Ghi lần thử hiện tại: PENDING + chứng từ kho / round + thông tin hiển thị; updated_at = now (chặn job đối soát). */
    public void start(UUID id, UUID stockDocId, int round, String docCode, String partnerName, UUID userId,
                      String payloadHash, String summary) {
        jdbc.update("""
                update checkout_attempts set status = 'PENDING', stock_doc_id = ?, round = ?, doc_code = ?, partner_name = ?,
                       user_id = ?, payload_hash = ?, summary = ?, last_error = null, updated_at = now() where id = ?""",
                stockDocId, round, docCode, partnerName, userId, payloadHash, summary, id);
    }

    /** PENDING → DONE đúng chứng từ kho đã dùng; false = dòng không còn PENDING (đang / đã bị hoàn kho) hoặc khác round. */
    public boolean markDone(UUID id, UUID stockDocId) {
        return jdbc.update("update checkout_attempts set status = 'DONE', updated_at = now()"
                + " where id = ? and stock_doc_id = ? and status = 'PENDING'", id, stockDocId) == 1;
    }

    public void setStatus(UUID id, String status, String error) {
        jdbc.update("update checkout_attempts set status = ?, last_error = ?, updated_at = now() where id = ?",
                status, error, id);
    }

    /** COMPENSATING → COMPENSATED, chỉ khi vẫn đúng chứng từ kho vừa hoàn. */
    public void markCompensated(UUID id, UUID stockDocId) {
        jdbc.update("update checkout_attempts set status = 'COMPENSATED', last_error = null, updated_at = now()"
                + " where id = ? and stock_doc_id = ? and status = 'COMPENSATING'", id, stockDocId);
    }

    /** Lần thanh toán còn mở (PENDING / COMPENSATING) chưa đụng tới từ trước thời điểm olderThan. */
    public List<UUID> openOlderThan(Instant olderThan, int limit) {
        return jdbc.queryForList("select id from checkout_attempts where status in ('PENDING', 'COMPENSATING')"
                + " and updated_at < ? order by updated_at limit ?", UUID.class, Timestamp.from(olderThan), limit);
    }

    public boolean invoiceExists(UUID id) {
        Boolean b = jdbc.queryForObject("select exists(select 1 from invoices where id = ?)", Boolean.class, id);
        return Boolean.TRUE.equals(b);
    }
}
