package com.vaxclinic.product.report;

import com.vaxclinic.product.report.InventoryReportRepository.MonthValue;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Chiết khấu thanh toán nhận từ NCC theo tháng từ sổ công nợ NCC (phiếu DISCOUNT còn hiệu lực). Chỉ truy cập DB. */
@Repository
public class SupplierPaymentDiscountReportRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public SupplierPaymentDiscountReportRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Tham số :from, :to, :branches từ {@link ProductReportScope}; tháng theo giờ Việt Nam. */
    public List<MonthValue> monthly(MapSqlParameterSource p) {
        return jdbc.query("""
                select to_char(d.occurred_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM') m, sum(d.amount) val
                from supplier_debt_docs d
                where d.kind = 'DISCOUNT' and d.status = 'ACTIVE' and d.occurred_at >= :from and d.occurred_at < :to
                  and d.branch_id in (:branches)
                group by 1 order by 1""", p,
                (rs, n) -> new MonthValue(rs.getString("m"), rs.getBigDecimal("val")));
    }
}
