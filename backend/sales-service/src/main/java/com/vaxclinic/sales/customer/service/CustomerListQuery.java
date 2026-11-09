package com.vaxclinic.sales.customer.service;

import com.vaxclinic.sales.customer.dto.CustomerDtos;
import com.vaxclinic.common.search.AccentInsensitiveSql;
import com.vaxclinic.sales.customer.dto.CustomerDtos.CustomerListItem;
import com.vaxclinic.sales.customer.dto.CustomerDtos.CustomerListResponse;
import com.vaxclinic.sales.customer.dto.CustomerDtos.DebtLine;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Danh sách khách hàng + bộ lọc trái (nhóm, ngày tạo, người tạo, loại khách, giới tính) + dòng tổng. */
@Component
public class CustomerListQuery {

    public record Filter(String q, UUID groupId, String groupName, Instant createdFrom, Instant createdTo, UUID createdBy,
                         String customerType, String gender, int page, int size) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public CustomerListQuery(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public CustomerListResponse search(Filter f) {
        var p = new MapSqlParameterSource();
        var w = new StringBuilder(" from customers c left join customer_groups g on g.id = c.group_id where c.active");
        if (f.q() != null && !f.q().isBlank()) {
            w.append(" and (c.code ilike :q or " + AccentInsensitiveSql.like("c.name", ":q") + " or c.phone ilike :q or c.phone2 ilike :q)");
            p.addValue("q", "%" + f.q().trim() + "%");
        }
        if (f.groupId() != null) {
            w.append(" and c.group_id = :groupId");
            p.addValue("groupId", f.groupId());
        } else if (f.groupName() != null && !f.groupName().isBlank()) {
            w.append(" and c.group_name = :groupName");
            p.addValue("groupName", f.groupName());
        }
        if (f.createdFrom() != null) {
            w.append(" and c.created_at >= :from");
            p.addValue("from", Timestamp.from(f.createdFrom()));
        }
        if (f.createdTo() != null) {
            w.append(" and c.created_at < :to");
            p.addValue("to", Timestamp.from(f.createdTo()));
        }
        if (f.createdBy() != null) {
            w.append(" and c.created_by = :createdBy");
            p.addValue("createdBy", f.createdBy());
        }
        if (f.customerType() != null) {
            w.append(" and c.customer_type = :type");
            p.addValue("type", f.customerType());
        }
        if (f.gender() != null) {
            w.append(" and c.gender = :gender");
            p.addValue("gender", f.gender());
        }
        var agg = jdbc.queryForMap("select count(*) cnt, coalesce(sum(c.debt),0) debt, coalesce(sum(c.total_sales),0) sales,"
                + " coalesce(sum(c.total_sales - c.total_returns),0) net" + w, p);
        p.addValue("limit", f.size()).addValue("offset", (long) f.page() * f.size());
        var items = jdbc.query("select c.*, g.discount_type, g.discount_value" + w + " order by c.created_at desc limit :limit offset :offset", p,
                (rs, i) -> new CustomerListItem(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                        rs.getString("phone"), rs.getObject("group_id", UUID.class), rs.getString("group_name"),
                        rs.getString("discount_type"), rs.getBigDecimal("discount_value"), rs.getBigDecimal("debt"),
                        rs.getBigDecimal("total_sales"),
                        rs.getBigDecimal("total_sales").subtract(rs.getBigDecimal("total_returns"))));
        return new CustomerListResponse(items, ((Number) agg.get("cnt")).longValue(), f.page(), f.size(),
                (BigDecimal) agg.get("debt"), (BigDecimal) agg.get("sales"), (BigDecimal) agg.get("net"));
    }

    /** Tab "Nợ cần thu từ khách" — mới nhất trước. */
    public List<DebtLine> debtLines(UUID customerId) {
        return jdbc.query("select * from customer_debt_ledger where customer_id = :id order by occurred_at desc, balance_after limit 200",
                new MapSqlParameterSource("id", customerId), (rs, n) -> new DebtLine(rs.getObject("id", UUID.class),
                        rs.getString("doc_type"), rs.getString("doc_code"), rs.getObject("doc_id", UUID.class),
                        rs.getTimestamp("occurred_at").toInstant(), rs.getBigDecimal("amount"),
                        rs.getBigDecimal("balance_after"), rs.getString("note")));
    }
}
