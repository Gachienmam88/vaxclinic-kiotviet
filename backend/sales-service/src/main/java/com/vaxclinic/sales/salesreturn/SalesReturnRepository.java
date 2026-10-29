package com.vaxclinic.sales.salesreturn;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Ghi phiếu trả hàng (sales_returns + dòng + lô), hủy phiếu, dãy số mã TH; số lượng đã trả theo dòng / hóa đơn.
 * Đọc danh sách / chi tiết ở {@link SalesReturnQueryRepository}.
 */
@Repository
public class SalesReturnRepository {

    private final JdbcTemplate jdbc;

    public SalesReturnRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean exists(UUID id) {
        Integer n = jdbc.queryForObject("select count(*) from sales_returns where id = ?", Integer.class, id);
        return n != null && n > 0;
    }

    /** Toàn bộ cột phiếu (rỗng = không có). */
    public List<Map<String, Object>> find(UUID id) {
        return jdbc.queryForList("select * from sales_returns where id = ?", id);
    }

    /** Số tiếp theo của mã phiếu trả THxxxxxx. */
    public Long nextCodeNumber() {
        return jdbc.queryForObject("select nextval('sales_return_code_seq')", Long.class);
    }

    /** Số lượng đã trả của 1 dòng hóa đơn (phiếu trả còn hiệu lực). */
    public BigDecimal returnedQuantity(UUID invoiceLineId) {
        return jdbc.queryForObject("""
                select coalesce(sum(rl.quantity), 0) from sales_return_lines rl join sales_returns r on r.id = rl.return_id
                where rl.invoice_line_id = ? and r.status = 'COMPLETED'""", BigDecimal.class, invoiceLineId);
    }

    /** Số phiếu trả còn hiệu lực của hóa đơn. */
    public Integer countCompletedByInvoice(UUID invoiceId) {
        return jdbc.queryForObject("select count(*) from sales_returns where invoice_id = ? and status = 'COMPLETED'",
                Integer.class, invoiceId);
    }

    public void insert(UUID id, String code, UUID invoiceId, UUID branchId, UUID customerId, String customerName, UUID createdBy,
                       String createdByName, Instant returnedAt, BigDecimal subtotal, BigDecimal discount, BigDecimal fee,
                       BigDecimal total, BigDecimal refunded, String paymentMethod, String note) {
        jdbc.update("""
                insert into sales_returns(id, code, invoice_id, branch_id, customer_id, customer_name, created_by, created_by_name,
                    returned_at, status, subtotal, discount, fee, total, refunded, payment_method, note)
                values (?,?,?,?,?,?,?,?,?, 'COMPLETED', ?,?,?,?,?,?,?)""",
                id, code, invoiceId, branchId, customerId, customerName, createdBy,
                createdByName, Timestamp.from(returnedAt), subtotal, discount, fee, total, refunded, paymentMethod, note);
    }

    public void insertLine(UUID returnId, SalesReturnWriter.Row l, String lots) {
        jdbc.update("""
                insert into sales_return_lines(id, return_id, invoice_line_id, product_id, product_code, product_name,
                    unit_name, quantity, unit_price, lots, cost) values (?,?,?,?,?,?,?,?,?,?,?)""",
                l.lineId(), returnId, l.invoiceLineId(), l.productId(), l.productCode(), l.productName(),
                l.unitName(), l.quantity(), l.unitPrice(), lots, l.cost());
    }

    public void insertLineLot(UUID returnLineId, String lot, BigDecimal baseQty) {
        jdbc.update("insert into sales_return_line_lots(return_line_id, lot_number, base_qty) values (?,?,?)", returnLineId, lot, baseQty);
    }

    /** Khóa phiếu trước khi hủy (ném EmptyResultDataAccessException nếu không có). */
    public Map<String, Object> lockForCancel(UUID id) {
        return jdbc.queryForMap("select * from sales_returns where id = ? for update", id);
    }

    public void markCancelled(UUID id) {
        jdbc.update("update sales_returns set status = 'CANCELLED', cancelled_at = now() where id = ?", id);
    }
}
