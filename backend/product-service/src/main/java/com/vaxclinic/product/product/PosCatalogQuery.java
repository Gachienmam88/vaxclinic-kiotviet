package com.vaxclinic.product.product;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Danh mục cho màn bán hàng: mọi hàng đang kinh doanh + đơn vị bán trực tiếp + tồn tại 1 điểm tiêm.
 * Máy bán hàng tải 1 lần, lưu cục bộ → tìm hàng (F3) và quét mã vẫn chạy khi mất mạng.
 */
@Component
public class PosCatalogQuery {

    public record PosUnit(UUID id, String code, String barcode, String unitName, BigDecimal conversionRate,
                          BigDecimal price) {
    }

    /** taxCode: mã tỷ lệ thuế (KCT, VAT5...) — lưu lên dòng hóa đơn để phát hành hóa đơn điện tử. */
    public record PosProduct(UUID id, String name, boolean lotManaged, BigDecimal stock, String taxCode, List<PosUnit> units) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public PosCatalogQuery(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<PosProduct> load(UUID branchId) {
        Map<UUID, PosProduct> out = new LinkedHashMap<>();
        jdbc.query("""
                select p.id, p.name, p.lot_managed, coalesce(b.quantity, 0) stock,
                       u.id unit_id, u.code, u.barcode, u.unit_name, u.conversion_rate, u.price
                from products p
                join product_units u on u.product_id = p.id and u.direct_sale
                left join stock_balances b on b.product_id = p.id and b.branch_id = :branchId
                where p.active and not p.deleted
                order by p.name, u.sort_order""", new MapSqlParameterSource("branchId", branchId), rs -> {
            UUID id = rs.getObject("id", UUID.class);
            PosProduct p = out.computeIfAbsent(id, k -> {
                try {
                    return new PosProduct(id, rs.getString("name"), rs.getBoolean("lot_managed"),
                            rs.getBigDecimal("stock"), new ArrayList<>());
                } catch (java.sql.SQLException e) {
                    throw new IllegalStateException(e);
                }
            });
            p.units().add(new PosUnit(rs.getObject("unit_id", UUID.class), rs.getString("code"), rs.getString("barcode"),
                    rs.getString("unit_name"), rs.getBigDecimal("conversion_rate"), rs.getBigDecimal("price")));
        });
        return new ArrayList<>(out.values());
    }
}
