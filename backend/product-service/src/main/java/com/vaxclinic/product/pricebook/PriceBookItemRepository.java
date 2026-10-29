package com.vaxclinic.product.pricebook;

import com.vaxclinic.product.pricebook.PriceBookDtos.FormulaBase;
import com.vaxclinic.product.pricebook.PriceBookDtos.FormulaRequest;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Bảng price_book_items (+ giá chung product_units.price): ghi / xóa từng giá, áp công thức hàng loạt, tra mã hàng khi nhập file. Chỉ truy cập DB. */
@Repository
public class PriceBookItemRepository {

    private static final String UPSERT = """
            insert into price_book_items (price_book_id, unit_id, price) values (:book, :unit, :price)
            on conflict (price_book_id, unit_id) do update set price = excluded.price, updated_at = now()""";

    /** Giá của đơn vị u trong 1 bảng giá (tham số tên bảng giá truyền vào %s). */
    private static final String BOOK_PRICE =
            "(select y.price from price_book_items y where y.price_book_id = %s and y.unit_id = u.id)";

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
     * base = BOOK: baseBookId đã được service kiểm tra; CURRENT = giá hiện tại trong chính bảng giá này.
     */
    public int applyFormula(UUID bookId, FormulaRequest req) {
        var p = formulaParams(req).addValue("book", bookId);
        String base = req.base() == FormulaBase.CURRENT ? BOOK_PRICE.formatted(":book") : baseExpr(req, p);
        String from = PriceBookRowRepository.from(req.rowFilter(), req.onlyExisting() ? List.of(bookId) : null, p)
                + unitFilter(req, p);
        return jdbc.update("insert into price_book_items (price_book_id, unit_id, price) select :book, u.id, "
                + "price_book_formula(" + base + ", :op, :value, :pct)" + from + " and " + base + " is not null"
                + " on conflict (price_book_id, unit_id) do update set price = excluded.price, updated_at = now()", p);
    }

    /** Như {@link #applyFormula} nhưng ghi vào giá chung (product_units.price); CURRENT = BASE_PRICE = giá chung hiện tại. */
    public int applyFormulaToBase(FormulaRequest req) {
        var p = formulaParams(req);
        String base = baseExpr(req, p);
        String from = PriceBookRowRepository.from(req.rowFilter(), null, p) + unitFilter(req, p);
        return jdbc.update("update product_units t set price = x.np from (select u.id, price_book_formula(" + base
                + ", :op, :value, :pct) np" + from + " and " + base + " is not null) x where t.id = x.id", p);
    }

    /** Sửa giá chung 1 đơn vị tính; trigger tự cập nhật các bảng giá theo giá chung. */
    public int updateBasePrice(UUID unitId, BigDecimal price) {
        return jdbc.update("update product_units set price = :price where id = :unit", params(null, unitId, price));
    }

    private static String baseExpr(FormulaRequest req, MapSqlParameterSource p) {
        return switch (req.base()) {
            case BASE_PRICE, CURRENT -> "u.price";
            case COST -> PriceBookRowRepository.COST;
            case LAST_PURCHASE -> PriceBookRowRepository.LAST_PURCHASE;
            case BOOK -> {
                p.addValue("baseBook", req.baseBookId());
                yield BOOK_PRICE.formatted(":baseBook");
            }
        };
    }

    private static MapSqlParameterSource formulaParams(FormulaRequest req) {
        return new MapSqlParameterSource("op", req.op().name()).addValue("value", req.value())
                .addValue("pct", req.percent());
    }

    /** unitIds != null → chỉ các đơn vị này (VD đặt công thức cho 1 hàng). */
    private static String unitFilter(FormulaRequest req, MapSqlParameterSource p) {
        if (req.unitIds() == null) {
            return "";
        }
        p.addValue("unitIds", req.unitIds().isEmpty() ? List.of(new UUID(0, 0)) : req.unitIds());
        return " and u.id in (:unitIds)";
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
