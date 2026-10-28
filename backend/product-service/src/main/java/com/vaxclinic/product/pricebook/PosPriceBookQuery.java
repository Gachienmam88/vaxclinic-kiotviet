package com.vaxclinic.product.pricebook;

import com.vaxclinic.product.pricebook.PriceBookDtos.MissingPolicy;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Bảng giá cho màn bán hàng (lưu cùng danh mục để bán khi mất mạng): chỉ bảng "Áp dụng", chưa hết hạn, có phạm vi
 * chi nhánh chứa branchId. Máy bán hàng tự lọc tiếp theo ngày / nhóm khách / người bán (price-book-resolver.ts).
 */
@Component
public class PosPriceBookQuery {

    /** prices: unitId → giá. Phạm vi null = tất cả. */
    public record PosPriceBook(UUID id, String name, Instant validFrom, Instant validTo, List<UUID> branchIds,
                               List<UUID> customerGroupIds, List<UUID> sellerIds, MissingPolicy missingPolicy,
                               Map<UUID, BigDecimal> prices) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public PosPriceBookQuery(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<PosPriceBook> load(UUID branchId) {
        var p = new MapSqlParameterSource("branchId", branchId);
        Map<UUID, PosPriceBook> out = new LinkedHashMap<>();
        jdbc.query("""
                select * from price_books
                where active and valid_to > now() and (branch_ids is null or cast(:branchId as uuid) = any(branch_ids))
                order by lower(name)""", p, rs -> {
            UUID id = rs.getObject("id", UUID.class);
            out.put(id, new PosPriceBook(id, rs.getString("name"), rs.getTimestamp("valid_from").toInstant(),
                    rs.getTimestamp("valid_to").toInstant(), PriceBookService.uuids(rs, "branch_ids"),
                    PriceBookService.uuids(rs, "customer_group_ids"), PriceBookService.uuids(rs, "seller_ids"),
                    MissingPolicy.valueOf(rs.getString("missing_policy")), new HashMap<>()));
        });
        if (!out.isEmpty()) {
            jdbc.query("select price_book_id, unit_id, price from price_book_items where price_book_id in (:ids)",
                    new MapSqlParameterSource("ids", out.keySet()), rs -> {
                        out.get(rs.getObject("price_book_id", UUID.class)).prices()
                                .put(rs.getObject("unit_id", UUID.class), rs.getBigDecimal("price"));
                    });
        }
        return new ArrayList<>(out.values());
    }
}
