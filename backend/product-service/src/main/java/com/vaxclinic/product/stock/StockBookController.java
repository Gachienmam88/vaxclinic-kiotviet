package com.vaxclinic.product.stock;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

/**
 * Sổ chi tiết vật liệu, dụng cụ, sản phẩm, hàng hóa (S2d-HKD): tồn đầu kỳ, nhập, xuất, tồn cuối kỳ theo đơn vị cơ bản.
 * Giá trị: chứng từ với nhà cung cấp (nhập, trả hàng nhập, tồn đầu) tính theo giá giao dịch; còn lại theo giá vốn lúc phát sinh.
 */
@RestController
public class StockBookController {

    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    public record StockBookLine(UUID productId, String productCode, String productName, String unitName,
                                BigDecimal openingQty, BigDecimal openingValue, BigDecimal inQty, BigDecimal inValue,
                                BigDecimal outQty, BigDecimal outValue, BigDecimal closingQty, BigDecimal closingValue) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public StockBookController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/api/accounting/stock/summary")
    @PreAuthorize("hasAuthority('report.view') or hasAuthority('inventory.view')")
    public List<StockBookLine> summary(@RequestParam LocalDate from, @RequestParam LocalDate to,
                                       @RequestParam(required = false) List<UUID> branchIds) {
        var p = new MapSqlParameterSource()
                .addValue("from", Timestamp.from(from.atStartOfDay(VN).toInstant()))
                .addValue("to", Timestamp.from(to.plusDays(1).atStartOfDay(VN).toInstant()))
                .addValue("branches", branchIds == null || branchIds.isEmpty() ? null : branchIds.toArray(new UUID[0]))
                .addValue("allBranches", branchIds == null || branchIds.isEmpty());
        return jdbc.query("""
                with mv as (
                  select product_id, occurred_at, quantity,
                    round(quantity * case when doc_type in ('OPENING','PURCHASE','PURCHASE_CANCEL','PURCHASE_RETURN','PURCHASE_RETURN_CANCEL')
                                          then unit_price else cost end) val
                  from stock_ledger where occurred_at < :to and (:allBranches or branch_id = any(:branches))
                ), agg as (
                  select product_id,
                    sum(case when occurred_at < :from then quantity else 0 end) oq,
                    sum(case when occurred_at < :from then val else 0 end) ov,
                    sum(case when occurred_at >= :from and quantity > 0 then quantity else 0 end) iq,
                    sum(case when occurred_at >= :from and quantity > 0 then val else 0 end) iv,
                    sum(case when occurred_at >= :from and quantity < 0 then -quantity else 0 end) xq,
                    sum(case when occurred_at >= :from and quantity < 0 then -val else 0 end) xv
                  from mv group by product_id
                )
                select a.*, p.name, u.code, u.unit_name
                from agg a join products p on p.id = a.product_id
                left join product_units u on u.product_id = p.id and u.is_base
                where a.oq <> 0 or a.iq <> 0 or a.xq <> 0
                order by p.name""", p, (rs, i) -> {
            BigDecimal oq = rs.getBigDecimal("oq"), ov = rs.getBigDecimal("ov"), iq = rs.getBigDecimal("iq"),
                    iv = rs.getBigDecimal("iv"), xq = rs.getBigDecimal("xq"), xv = rs.getBigDecimal("xv");
            return new StockBookLine(rs.getObject("product_id", UUID.class), rs.getString("code"), rs.getString("name"),
                    rs.getString("unit_name"), oq, ov, iq, iv, xq, xv, oq.add(iq).subtract(xq), ov.add(iv).subtract(xv));
        });
    }
}
