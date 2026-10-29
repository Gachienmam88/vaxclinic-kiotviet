package com.vaxclinic.sales.invoice;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** SQL tra cứu của "Import file" hóa đơn: mã hóa đơn đã có, khách theo mã / số điện thoại. */
@Repository
public class InvoiceImportRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public InvoiceImportRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Mã hóa đơn (viết hoa) đã tồn tại → id hóa đơn. */
    public Map<String, UUID> existingCodes(List<String> upperCodes) {
        var out = new HashMap<String, UUID>();
        if (upperCodes.isEmpty()) {
            return out;
        }
        jdbc.query("select upper(code) code, id from invoices where upper(code) in (:codes)",
                new MapSqlParameterSource("codes", upperCodes), rs -> {
                    out.put(rs.getString("code"), rs.getObject("id", UUID.class));
                });
        return out;
    }

    public UUID customerByCode(String code) {
        var ids = jdbc.queryForList("select id from customers where upper(code) = upper(:code) and active",
                new MapSqlParameterSource("code", code.trim()), UUID.class);
        return ids.isEmpty() ? null : ids.get(0);
    }

    /** Khách đang hoạt động có số điện thoại (so theo chữ số) trùng; nhiều khách trùng số → khách tạo sớm nhất. */
    public UUID customerByPhone(String digits) {
        var ids = jdbc.queryForList("""
                select id from customers where active and (regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = :d
                  or regexp_replace(coalesce(phone2, ''), '\\D', '', 'g') = :d) order by created_at limit 1""",
                new MapSqlParameterSource("d", digits), UUID.class);
        return ids.isEmpty() ? null : ids.get(0);
    }
}
