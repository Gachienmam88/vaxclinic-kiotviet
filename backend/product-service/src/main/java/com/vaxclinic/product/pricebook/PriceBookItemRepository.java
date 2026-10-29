package com.vaxclinic.product.pricebook;

import com.vaxclinic.product.pricebook.PriceBookDtos.FormulaRequest;
import com.vaxclinic.product.pricebook.PriceBookDtos.RowFilter;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Bảng price_book_items: ghi / xóa từng giá, áp công thức hàng loạt, tra mã hàng khi nhập file. Chỉ truy cập DB. */
@Repository
public class PriceBookItemRepository {

    private static final String UPSERT = """
            insert into price_book_items (price_book_id, unit_id, price) values (:book, :unit, :price)
            on conflict (price_book_id, unit_id) do update set price = excluded.price, updated_at = now()""";

    private final NamedParameterJdbcTemplate jdbc;

    public PriceBookItemRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Integer countUnits(List<UUID> unitIds) {
        return jdbc.queryForObject("select count(*) from product_units where id in (:ids)",
                new MapSqlParameterSource("ids", unitIds), Integer.class);
    }

    public int delete(UUID bookId, UUID unitId) {
        return jdbc.update("delete from price_book_items where price_book_id = :book and unit_id = :unit", params(bookId, unitId, null));
    }

    public int upsert(UUID bookId, UUID unitId, BigDecimal price) {
        return jdbc.update(UPSERT, params(bookId, unitId, price));
    }

    /**
     * Ghi giá = công thức trên giá gốc cho mọi dòng thuộc bộ lọc của bảng Thiết lập giá (bỏ dòng không có giá gốc).
     * base = BOOK: baseBookId đã được service kiểm tra.
     */
    public int applyFormula(UUID bookId, FormulaRequest req) {
        var p = new MapSqlParameterSource("book", bookId).addValue("op", req.op().name())
                .addValue("value", req.value()).addValue("pct", req.percent());
        String base = switch (req.base()) {
            case BASE_PRICE -> "u.price";
            case COST -> PriceBookRowRepository.COST;
            case LAST_PURCHASE -> PriceBookRowRepository.LAST_PURCHASE;
            case BOOK -> {
                p.addValue("baseBook", req.baseBookId());
                yield "(select y.price from price_book_items y where y.price_book_id = :baseBook and y.unit_id = u.id)";
            }
        };
        var filter = new RowFilter(req.q(), req.categoryIds(), req.stock(), req.branchId(), false);
        String from = PriceBookRowRepository.from(filter, req.onlyExisting() ? List.of(bookId) : null, p);
        return jdbc.update("insert into price_book_items (price_book_id, unit_id, price) select :book, u.id, "
                + "price_book_formula(" + base + ", :op, :value, :pct)" + from + " and " + base + " is not null"
                + " on conflict (price_book_id, unit_id) do update set price = excluded.price, updated_at = now()", p);
    }

    /** lower(mã hàng) → unitId cho các mã (đã lower) của hàng chưa xóa. */
    public Map<String, UUID> unitIdsByCode(List<String> codes) {
        Map<String, UUID> units = new HashMap<>();
        jdbc.query("select u.id, lower(u.code) code from product_units u join products p on p.id = u.product_id"
                        + " where not p.deleted and lower(u.code) in (:codes)",
                new MapSqlParameterSource("codes", codes),
                rs -> {
                    units.put(rs.getString("code"), rs.getObject("id", UUID.class));
                });
        return units;
    }

    private static MapSqlParameterSource params(UUID bookId, UUID unitId, BigDecimal price) {
        return new MapSqlParameterSource("book", bookId).addValue("unit", unitId).addValue("price", price);
    }
}
