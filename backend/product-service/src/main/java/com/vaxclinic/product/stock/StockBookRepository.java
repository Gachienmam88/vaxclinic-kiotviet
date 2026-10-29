package com.vaxclinic.product.stock;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Sổ S2d-HKD từ thẻ kho (stock_ledger) + nhóm hàng của mọi mặt hàng. Chỉ truy cập DB. */
@Repository
public class StockBookRepository {

    public record StockBookLine(UUID productId, String productCode, String productName, String unitName,
                                BigDecimal openingQty, BigDecimal openingValue, BigDecimal inQty, BigDecimal inValue,
                                BigDecimal outQty, BigDecimal outValue, BigDecimal closingQty, BigDecimal closingValue) {
    }

    public record ProductCategory(UUID productId, UUID categoryId) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public StockBookRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Nhóm hàng của mọi mặt hàng (kể cả đã xóa). */
    public List<ProductCategory> productCategories() {
        return jdbc.query("select id, category_id from products",
                (rs, i) -> new ProductCategory(rs.getObject("id", UUID.class), rs.getObject("category_id", UUID.class)));
    }

    /** Tồn đầu / nhập / xuất / tồn cuối theo hàng trong [from, to); branchIds rỗng / null = mọi chi nhánh. */
    public List<StockBookLine> summary(Instant from, Instant to, List<UUID> branchIds) {
        var p = new MapSqlParameterSource()
                .addValue("from", Timestamp.from(from))
                .addValue("to", Timestamp.from(to))
                // Danh sách rỗng → "in ()" sai cú pháp: thay bằng 1 id giả, cờ allBranches bỏ qua điều kiện
                .addValue("branches", branchIds == null || branchIds.isEmpty() ? List.of(new UUID(0, 0)) : branchIds)
                .addValue("allBranches", branchIds == null || branchIds.isEmpty());
        return jdbc.query("""
                with mv as (
                  select product_id, occurred_at, quantity,
                    round(quantity * case when doc_type in ('OPENING','PURCHASE','PURCHASE_CANCEL','PURCHASE_RETURN','PURCHASE_RETURN_CANCEL')
                                          then unit_price else cost end) val
                  from stock_ledger where occurred_at < :to and (:allBranches or branch_id in (:branches))
                ), agg as (
                  select product_id,
                    sum(case when occurred_at < :from then quantity else 0 end) oq,
                    sum(case when occurred_at < :from then val else 0 end) ov,
                    sum(case when occurred_at >= :from and quantity > 0 then quantity else 0 end) iq,
                    sum(case when occurred_at >= :from and quantity > 0 then val else 0 end) iv,
                    sum(case when occurred_at >= :from and quantity < 0 then -quantity else 0 end) xq,
                    sum(case when occurred_at >= :from and quantity < 0 then -val else 0 end) xv
                  from mv group by product_id
                )
                select a.*, p.name, u.code, u.unit_name
                from agg a join products p on p.id = a.product_id
                left join product_units u on u.product_id = p.id and u.is_base
                where a.oq <> 0 or a.iq <> 0 or a.xq <> 0
                order by p.name""", p, (rs, i) -> {
            BigDecimal oq = rs.getBigDecimal("oq"), ov = rs.getBigDecimal("ov"), iq = rs.getBigDecimal("iq"),
                    iv = rs.getBigDecimal("iv"), xq = rs.getBigDecimal("xq"), xv = rs.getBigDecimal("xv");
            return new StockBookLine(rs.getObject("product_id", UUID.class), rs.getString("code"), rs.getString("name"),
                    rs.getString("unit_name"), oq, ov, iq, iv, xq, xv, oq.add(iq).subtract(xq), ov.add(iv).subtract(xv));
        });
    }
}
