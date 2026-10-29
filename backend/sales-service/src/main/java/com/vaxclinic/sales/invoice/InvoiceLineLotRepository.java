package com.vaxclinic.sales.invoice;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Lô đã xuất của từng dòng hóa đơn (invoice_line_lots): ghi khi bán / sửa, đọc phần còn trả được khi trả hàng. */
@Repository
public class InvoiceLineLotRepository {

    private final JdbcTemplate jdbc;

    public InvoiceLineLotRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Cộng dồn số lượng (đơn vị cơ bản) của lô vào dòng; lotNumber "" = hàng không theo lô. */
    public void add(UUID lineId, String lotNumber, BigDecimal baseQty) {
        jdbc.update("""
                insert into invoice_line_lots(line_id, lot_number, base_qty) values (?,?,?)
                on conflict (line_id, lot_number) do update set base_qty = invoice_line_lots.base_qty + excluded.base_qty""",
                lineId, lotNumber, baseQty);
    }

    /** Lô của dòng → số lượng cơ bản còn trả được (trừ phiếu trả còn hiệu lực), theo số lô. */
    public Map<String, BigDecimal> returnableLots(UUID lineId) {
        Map<String, BigDecimal> available = new LinkedHashMap<>();
        jdbc.query("""
                select l.lot_number, l.base_qty - coalesce((select sum(x.base_qty) from sales_return_line_lots x
                    join sales_return_lines rl on rl.id = x.return_line_id join sales_returns r on r.id = rl.return_id
                    where rl.invoice_line_id = l.line_id and x.lot_number = l.lot_number and r.status = 'COMPLETED'), 0) left_qty
                from invoice_line_lots l where l.line_id = ? order by l.lot_number""",
                rs -> { available.put(rs.getString(1), rs.getBigDecimal(2)); }, lineId);
        return available;
    }

    /** Tổng số lượng cơ bản đã xuất của dòng. */
    public BigDecimal soldBaseQuantity(UUID lineId) {
        return jdbc.queryForObject("select coalesce(sum(base_qty), 0) from invoice_line_lots where line_id = ?",
                BigDecimal.class, lineId);
    }
}
