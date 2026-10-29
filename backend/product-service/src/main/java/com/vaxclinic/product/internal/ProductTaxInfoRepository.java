package com.vaxclinic.product.internal;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Array;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Thông tin thuế của hàng cho sales-service tính "Giảm thuế": mã thuế suất, cờ "Áp dụng giảm thuế",
 * chuỗi nhóm hàng từ nhóm của hàng lên nhóm gốc (để tra ngành nghề — nhóm con chưa gắn ngành thì theo nhóm cha).
 */
@Repository
public class ProductTaxInfoRepository {

    public record ProductTaxInfo(UUID productId, String taxCode, boolean taxReduction, List<UUID> categoryPath) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public ProductTaxInfoRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<ProductTaxInfo> find(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.query("""
                with recursive path(product_id, category_id, depth) as (
                    select p.id, p.category_id, 0 from products p where p.id in (:ids) and p.category_id is not null
                    union all
                    select path.product_id, c.parent_id, path.depth + 1 from path join categories c on c.id = path.category_id
                    where c.parent_id is not null and path.depth < 20)
                select p.id, t.code tax_code, p.tax_reduction,
                       array(select category_id from path where path.product_id = p.id order by depth) category_path
                from products p left join tax_rates t on t.id = p.tax_rate_id where p.id in (:ids)""",
                new MapSqlParameterSource("ids", ids), (rs, n) -> {
                    Array arr = rs.getArray("category_path");
                    List<UUID> path = arr == null ? List.of() : Arrays.stream((Object[]) arr.getArray()).map(o -> (UUID) o).toList();
                    return new ProductTaxInfo(rs.getObject("id", UUID.class), rs.getString("tax_code"), rs.getBoolean("tax_reduction"), path);
                });
    }
}
