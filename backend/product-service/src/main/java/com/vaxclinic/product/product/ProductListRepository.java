package com.vaxclinic.product.product;

import com.vaxclinic.common.search.AccentInsensitiveSql;
import com.vaxclinic.product.product.ProductDtos.ProductListItem;
import com.vaxclinic.product.product.ProductDtos.ProductListResponse;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Array;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * Danh sách hàng hóa với bộ lọc bên trái (nhóm hàng, thuế, giảm thuế, tồn kho, thời gian tạo, trạng thái).
 * Dùng SQL thuần vì lọc theo tồn kho cần join + group by mà JPA viết rất rối.
 */
@Repository
public class ProductListRepository {

    /** Tiêu chí tồn: ALL, BELOW_MIN (dưới định mức), ABOVE_MAX (vượt định mức), IN_STOCK (còn hàng), OUT_OF_STOCK (hết hàng). */
    public enum StockFilter { ALL, BELOW_MIN, ABOVE_MAX, IN_STOCK, OUT_OF_STOCK }

    public record Filter(String q, List<UUID> categoryIds, List<UUID> taxRateIds, Boolean taxReduction,
                         StockFilter stock, UUID branchId, Instant createdFrom, Instant createdTo, Boolean active,
                         int page, int size) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public ProductListRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public ProductListResponse search(Filter f) {
        var params = new MapSqlParameterSource();
        // Tồn theo 1 điểm tiêm hoặc tổng tất cả điểm tiêm.
        String stockJoin = """
                left join (select product_id, sum(quantity) qty, sum(reserved) rsv from stock_balances
                           where (cast(:branchId as uuid) is null or branch_id = cast(:branchId as uuid))
                           group by product_id) s on s.product_id = p.id
                """;
        params.addValue("branchId", f.branchId());

        var where = new StringBuilder(" where not p.deleted");
        if (f.q() != null && !f.q().isBlank()) {
            // Leading space is explicit: text blocks strip indentation.
            where.append(" and (" + AccentInsensitiveSql.like("p.name", ":q") + " or " + AccentInsensitiveSql.like("p.short_name", ":q"))
                    .append(" or exists (select 1 from product_units x where x.product_id = p.id")
                    .append(" and (x.code ilike :q or x.barcode ilike :q)))");
            params.addValue("q", "%" + f.q().trim() + "%");
        }
        if (f.categoryIds() != null && !f.categoryIds().isEmpty()) {
            // Chọn nhóm cha thì lấy cả nhóm con (đệ quy).
            where.append(" and p.category_id in (with recursive t as (select id from categories where id in (:categoryIds)")
                    .append(" union all select c.id from categories c join t on c.parent_id = t.id) select id from t)");
            params.addValue("categoryIds", f.categoryIds());
        }
        if (f.taxRateIds() != null && !f.taxRateIds().isEmpty()) {
            where.append(" and p.tax_rate_id in (:taxRateIds)");
            params.addValue("taxRateIds", f.taxRateIds());
        }
        if (f.taxReduction() != null) {
            where.append(" and p.tax_reduction = :taxReduction");
            params.addValue("taxReduction", f.taxReduction());
        }
        if (f.active() != null) {
            where.append(" and p.active = :active");
            params.addValue("active", f.active());
        }
        if (f.createdFrom() != null) {
            where.append(" and p.created_at >= :createdFrom");
            params.addValue("createdFrom", java.sql.Timestamp.from(f.createdFrom()));
        }
        if (f.createdTo() != null) {
            where.append(" and p.created_at < :createdTo");
            params.addValue("createdTo", java.sql.Timestamp.from(f.createdTo()));
        }
        switch (f.stock() == null ? StockFilter.ALL : f.stock()) {
            case BELOW_MIN -> where.append(" and coalesce(s.qty, 0) < p.min_stock");
            case ABOVE_MAX -> where.append(" and coalesce(s.qty, 0) > p.max_stock");
            case IN_STOCK -> where.append(" and coalesce(s.qty, 0) > 0");
            case OUT_OF_STOCK -> where.append(" and coalesce(s.qty, 0) <= 0");
            case ALL -> { }
        }

        String from = " from products p join product_units u on u.product_id = p.id and u.is_base "
                + "left join tax_rates t on t.id = p.tax_rate_id " + stockJoin + where;

        var totals = jdbc.queryForMap("select count(*) cnt, coalesce(sum(s.qty), 0) total_stock" + from, params);
        params.addValue("limit", f.size()).addValue("offset", (long) f.page() * f.size());
        // Dự kiến hết hàng = tồn / (số bán ròng 30 ngày gần nhất ÷ số ngày). Hàng tạo chưa đủ 30 ngày thì chia theo
        // số ngày từ lúc tạo (tối thiểu 1) để không đánh giá thấp tốc độ bán.
        List<ProductListItem> items = jdbc.query("""
                select p.id, u.code, p.name, p.short_name, u.unit_name, u.price, p.cost, t.name tax_name,
                       p.tax_reduction, p.lot_managed, coalesce(s.qty, 0) qty, coalesce(s.rsv, 0) rsv, p.active,
                       p.created_at,
                       array(select o.unit_name from product_units o
                             where o.product_id = p.id and not o.is_base order by o.sort_order) other_units,
                       (select case when sold > 0 then floor(greatest(coalesce(s.qty, 0), 0) * least(30,
                                   greatest(1, ceil(extract(epoch from now() - p.created_at) / 86400))) / sold)::int end
                        from (select -sum(l.quantity) sold from stock_ledger l
                              where l.product_id = p.id and l.doc_type in ('SALE', 'RETURN')
                                and l.occurred_at >= now() - interval '30 days'
                                and (cast(:branchId as uuid) is null or l.branch_id = cast(:branchId as uuid))) v
                       ) expected_out_days
                """ + from + " order by p.created_at desc limit :limit offset :offset", params,
                (rs, i) -> new ProductListItem(rs.getObject("id", UUID.class), rs.getString("code"),
                        rs.getString("name"), rs.getString("short_name"), rs.getString("unit_name"),
                        toList(rs.getArray("other_units")), rs.getBigDecimal("price"), rs.getBigDecimal("cost"),
                        rs.getString("tax_name"), rs.getBoolean("tax_reduction"), rs.getBoolean("lot_managed"),
                        rs.getBigDecimal("qty"), rs.getBigDecimal("rsv"), rs.getBoolean("active"),
                        rs.getTimestamp("created_at").toInstant(), rs.getObject("expected_out_days", Integer.class)));

        return new ProductListResponse(items, ((Number) totals.get("cnt")).longValue(), f.page(), f.size(),
                (BigDecimal) totals.get("total_stock"));
    }

    private static List<String> toList(Array array) throws SQLException {
        return array == null ? List.of() : Arrays.asList((String[]) array.getArray());
    }
}
