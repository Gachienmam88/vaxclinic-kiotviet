package com.vaxclinic.product.pricebook.service;

import com.vaxclinic.product.pricebook.dto.PriceBookDtos;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.FormulaRequest;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.ImportError;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.ImportResult;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.ImportRow;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.ItemInput;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.RowFilter;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Ghi giá trong bảng giá: sửa từng ô / hàng loạt, áp dụng công thức, nhập file (Mã hàng, Giá). */
@Service
public class PriceBookItemService {

    private static final String UPSERT = """
            insert into price_book_items (price_book_id, unit_id, price) values (:book, :unit, :price)
            on conflict (price_book_id, unit_id) do update set price = excluded.price, updated_at = now()""";

    private final NamedParameterJdbcTemplate jdbc;
    private final PriceBookService books;

    public PriceBookItemService(NamedParameterJdbcTemplate jdbc, PriceBookService books) {
        this.jdbc = jdbc;
        this.books = books;
    }

    /** price = null → xóa khỏi bảng giá. Trả về số dòng đã ghi. */
    @Transactional
    public int upsert(UUID bookId, List<ItemInput> items) {
        books.get(bookId);
        var unitIds = items.stream().map(ItemInput::unitId).distinct().toList();
        Integer found = jdbc.queryForObject("select count(*) from product_units where id in (:ids)",
                new MapSqlParameterSource("ids", unitIds), Integer.class);
        if (found == null || found != unitIds.size()) {
            throw BusinessException.badRequest("UNIT_NOT_FOUND", "Có hàng hóa không tồn tại");
        }
        int n = 0;
        for (ItemInput it : items) {
            var p = new MapSqlParameterSource("book", bookId).addValue("unit", it.unitId()).addValue("price", it.price());
            n += it.price() == null
                    ? jdbc.update("delete from price_book_items where price_book_id = :book and unit_id = :unit", p)
                    : jdbc.update(UPSERT, p);
        }
        return n;
    }

    /** Giá mới = gốc ± value (VNĐ hoặc %), làm tròn VNĐ, tối thiểu 0. Dòng không có giá gốc (VD chưa nhập hàng) bỏ qua. */
    @Transactional
    public int applyFormula(UUID bookId, FormulaRequest req) {
        books.get(bookId);
        var p = new MapSqlParameterSource("book", bookId).addValue("op", req.op().name())
                .addValue("value", req.value()).addValue("pct", req.percent());
        String base = switch (req.base()) {
            case BASE_PRICE -> "u.price";
            case COST -> PriceBookRowQuery.COST;
            case LAST_PURCHASE -> PriceBookRowQuery.LAST_PURCHASE;
            case BOOK -> {
                if (req.baseBookId() == null) {
                    throw BusinessException.badRequest("FORMULA_BOOK_REQUIRED", "Chọn bảng giá làm gốc công thức");
                }
                books.get(req.baseBookId());
                p.addValue("baseBook", req.baseBookId());
                yield "(select y.price from price_book_items y where y.price_book_id = :baseBook and y.unit_id = u.id)";
            }
        };
        var filter = new RowFilter(req.q(), req.categoryIds(), req.stock(), req.branchId(), false);
        String from = PriceBookRowQuery.from(filter, req.onlyExisting() ? List.of(bookId) : null, p);
        return jdbc.update("insert into price_book_items (price_book_id, unit_id, price) select :book, u.id, "
                + "price_book_formula(" + base + ", :op, :value, :pct)" + from + " and " + base + " is not null"
                + " on conflict (price_book_id, unit_id) do update set price = excluded.price, updated_at = now()", p);
    }

    /** Dòng hợp lệ được ghi, dòng lỗi trả về kèm số dòng; mã hàng trùng trong file → lấy dòng sau cùng. */
    @Transactional
    public ImportResult importRows(UUID bookId, List<ImportRow> rows) {
        books.get(bookId);
        var codes = rows.stream().map(r -> r.code() == null ? "" : r.code().trim().toLowerCase()).distinct().toList();
        Map<String, UUID> units = new HashMap<>();
        jdbc.query("select u.id, lower(u.code) code from product_units u join products p on p.id = u.product_id"
                        + " where not p.deleted and lower(u.code) in (:codes)",
                new MapSqlParameterSource("codes", codes),
                rs -> {
                    units.put(rs.getString("code"), rs.getObject("id", UUID.class));
                });
        var errors = new ArrayList<ImportError>();
        int n = 0;
        for (ImportRow r : rows) {
            String code = r.code() == null ? "" : r.code().trim();
            UUID unit = units.get(code.toLowerCase());
            BigDecimal price = parsePrice(r.price());
            if (code.isEmpty()) {
                errors.add(new ImportError(r.line(), code, "Thiếu mã hàng"));
            } else if (unit == null) {
                errors.add(new ImportError(r.line(), code, "Không tìm thấy mã hàng"));
            } else if (price == null) {
                errors.add(new ImportError(r.line(), code, "Giá không hợp lệ: " + (r.price() == null ? "" : r.price())));
            } else if (price.signum() < 0) {
                errors.add(new ImportError(r.line(), code, "Giá không được âm"));
            } else {
                n += jdbc.update(UPSERT, new MapSqlParameterSource("book", bookId).addValue("unit", unit).addValue("price", price));
            }
        }
        return new ImportResult(n, errors);
    }

    /** "1,250,000" / "1250000" / "1250000.5" → số; trống hoặc sai định dạng → null. */
    static BigDecimal parsePrice(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(s.trim().replace(",", "").replace(" ", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
