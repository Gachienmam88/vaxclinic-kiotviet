package com.vaxclinic.product.pricebook.service;

import com.vaxclinic.product.pricebook.dto.PriceBookDtos;
import com.vaxclinic.common.search.AccentInsensitiveSql;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.PriceRow;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.RowFilter;
import com.vaxclinic.product.product.service.ProductListQuery.StockFilter;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Bảng Thiết lập giá: mỗi dòng = 1 đơn vị tính (mã hàng) của hàng đang kinh doanh, kèm Giá vốn (theo đơn vị),
 * Giá nhập cuối (phiếu nhập hoàn thành gần nhất), Giá chung và giá ở từng bảng giá đang chọn.
 * Mệnh đề FROM/WHERE dùng chung với "Áp dụng công thức" để công thức chạy đúng tập dòng đang lọc.
 */
@Component
public class PriceBookRowQuery {

    /** Giá vốn bình quân lưu theo đơn vị cơ bản → nhân quy đổi. */
    static final String COST = "(p.cost * u.conversion_rate)";
    /** Đơn giá sau giảm của dòng nhập gần nhất (phiếu đã hoàn thành). */
    static final String LAST_PURCHASE = """
            (select l.unit_price - l.discount from purchase_receipt_lines l
             join purchase_receipts r on r.id = l.receipt_id
             where l.unit_id = u.id and r.status = 'COMPLETED' order by r.received_at desc, l.line_no limit 1)""";

    private final NamedParameterJdbcTemplate jdbc;

    public PriceBookRowQuery(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** inBooks != null: chỉ đơn vị đã có trong ít nhất 1 bảng giá trong danh sách. Chuỗi bắt đầu bằng khoảng trắng. */
    static String from(RowFilter f, List<UUID> inBooks, MapSqlParameterSource p) {
        // Khoảng trắng đầu phải viết tường minh: text block cắt thụt lề.
        var w = new StringBuilder(" ").append("""
                from product_units u join products p on p.id = u.product_id
                left join (select product_id, sum(quantity) qty from stock_balances
                           where (cast(:branchId as uuid) is null or branch_id = cast(:branchId as uuid))
                           group by product_id) s on s.product_id = p.id
                where not p.deleted and p.active""");
        p.addValue("branchId", f.branchId());
        if (f.q() != null && !f.q().isBlank()) {
            w.append(" and (" + AccentInsensitiveSql.like("p.name", ":q") + " or u.code ilike :q or u.barcode ilike :q)");
            p.addValue("q", "%" + f.q().trim() + "%");
        }
        if (f.categoryIds() != null && !f.categoryIds().isEmpty()) {
            w.append(" and p.category_id in (with recursive t as (select id from categories where id in (:categoryIds)")
                    .append(" union all select c.id from categories c join t on c.parent_id = t.id) select id from t)");
            p.addValue("categoryIds", f.categoryIds());
        }
        switch (stock(f.stock())) {
            case BELOW_MIN -> w.append(" and coalesce(s.qty, 0) < p.min_stock");
            case ABOVE_MAX -> w.append(" and coalesce(s.qty, 0) > p.max_stock");
            case IN_STOCK -> w.append(" and coalesce(s.qty, 0) > 0");
            case OUT_OF_STOCK -> w.append(" and coalesce(s.qty, 0) <= 0");
            case ALL -> { }
        }
        if (inBooks != null) {
            w.append(" and exists (select 1 from price_book_items x where x.unit_id = u.id and x.price_book_id in (:inBooks))");
            p.addValue("inBooks", inBooks);
        }
        return w.toString();
    }

    private static StockFilter stock(String s) {
        if (s == null || s.isBlank()) {
            return StockFilter.ALL;
        }
        try {
            return StockFilter.valueOf(s);
        } catch (IllegalArgumentException e) {
            throw BusinessException.badRequest("STOCK_FILTER_INVALID", "Tiêu chí tồn kho không hợp lệ");
        }
    }

    public PageResponse<PriceRow> rows(List<UUID> bookIds, RowFilter f, int page, int size) {
        var p = new MapSqlParameterSource();
        List<UUID> books = bookIds == null ? List.of() : bookIds;
        String from = from(f, f.inBookOnly() && !books.isEmpty() ? books : null, p);
        long total = jdbc.queryForObject("select count(*)" + from, p, Long.class);
        p.addValue("limit", size).addValue("offset", (long) page * size);
        Map<UUID, Map<UUID, BigDecimal>> prices = new HashMap<>();
        List<PriceRow> items = jdbc.query("select u.id unit_id, p.id product_id, u.code, p.name, u.unit_name, u.price, "
                + COST + " cost, " + LAST_PURCHASE + " last_price" + from
                + " order by p.name, p.id, u.sort_order limit :limit offset :offset", p, (rs, i) -> {
            UUID unitId = rs.getObject("unit_id", UUID.class);
            Map<UUID, BigDecimal> unitPrices = new LinkedHashMap<>();
            prices.put(unitId, unitPrices);
            return new PriceRow(unitId, rs.getObject("product_id", UUID.class), rs.getString("code"), rs.getString("name"),
                    rs.getString("unit_name"), rs.getBigDecimal("cost"), rs.getBigDecimal("last_price"),
                    rs.getBigDecimal("price"), unitPrices);
        });
        if (!items.isEmpty() && !books.isEmpty()) {
            jdbc.query("select price_book_id, unit_id, price from price_book_items where unit_id in (:units) and price_book_id in (:books)",
                    new MapSqlParameterSource("units", prices.keySet()).addValue("books", books),
                    rs -> {
                        prices.get(rs.getObject("unit_id", UUID.class))
                                .put(rs.getObject("price_book_id", UUID.class), rs.getBigDecimal("price"));
                    });
        }
        return new PageResponse<>(items, total, page, size);
    }
}
