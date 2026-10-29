package com.vaxclinic.product.notification;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Truy vấn cho {@link StockAlertJob}: lô còn tồn sắp / đã hết hạn, hàng dưới định mức tồn. Chỉ truy cập DB. */
@Repository
public class StockAlertRepository {

    private final JdbcTemplate jdbc;

    public StockAlertRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Lô còn tồn của hàng chưa xóa, hạn dùng ≤ expiryUntil: id, branch_id, lot_number, expiry_date, quantity, name, code. */
    public List<Map<String, Object>> expiringLots(LocalDate expiryUntil) {
        return jdbc.queryForList("""
                select l.id, l.branch_id, l.lot_number, l.expiry_date, l.quantity, p.name, u.code
                from product_lots l join products p on p.id = l.product_id
                join product_units u on u.product_id = p.id and u.is_base
                where l.quantity > 0 and not p.deleted and l.expiry_date <= ?""", Date.valueOf(expiryUntil));
    }

    /** Hàng đang kinh doanh có tồn dưới định mức tại từng chi nhánh: id, branch_id, quantity, min_stock, name, code. */
    public List<Map<String, Object>> lowStock() {
        return jdbc.queryForList("""
                select p.id, b.branch_id, coalesce(sb.quantity, 0) as quantity, p.min_stock, p.name, u.code
                from products p join product_units u on u.product_id = p.id and u.is_base
                cross join (select distinct branch_id from stock_balances) b
                left join stock_balances sb on sb.product_id = p.id and sb.branch_id = b.branch_id
                where not p.deleted and p.active and p.min_stock > 0 and coalesce(sb.quantity, 0) < p.min_stock""");
    }
}
