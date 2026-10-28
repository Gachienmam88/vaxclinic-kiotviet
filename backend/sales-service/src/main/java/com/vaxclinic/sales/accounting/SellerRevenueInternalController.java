package com.vaxclinic.sales.accounting;

import com.vaxclinic.common.settings.ShopSettings;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Doanh thu theo người bán × mặt hàng (identity-service tính hoa hồng nhân viên; chỉ JWT "internal", gateway không route /internal).
 * Hóa đơn hoàn thành trong kỳ − hàng khách trả trong kỳ (quy về người bán của hóa đơn gốc; "Trả nhanh" không theo hóa đơn
 * → trừ vào người lập phiếu trả, tính đủ cả thực thu vì tiền đã hoàn cho khách), theo giờ Việt Nam.
 * netRevenue: sau phân bổ giảm giá hóa đơn theo tỷ lệ tiền hàng (như Sổ doanh thu);
 * paidRevenue: netRevenue × tỷ lệ khách đã trả của hóa đơn (thực thu, tối đa 100%).
 */
@RestController
public class SellerRevenueInternalController {

    public record SellerRevenue(UUID sellerId, UUID productId, String productCode, String productName, BigDecimal quantity,
                                BigDecimal netRevenue, BigDecimal paidRevenue) {
    }

    private final NamedParameterJdbcTemplate jdbc;

    public SellerRevenueInternalController(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/internal/seller-revenue")
    @PreAuthorize("hasAuthority('internal')")
    public List<SellerRevenue> revenue(@RequestParam LocalDate from, @RequestParam LocalDate to) {
        var params = new MapSqlParameterSource()
                .addValue("from", Timestamp.from(from.atStartOfDay(ShopSettings.ZONE).toInstant()))
                .addValue("to", Timestamp.from(to.plusDays(1).atStartOfDay(ShopSettings.ZONE).toInstant()));
        return jdbc.query("""
                with sale as (
                  select i.seller_id, l.product_id, max(l.product_code) code, max(l.product_name) name, sum(l.quantity) qty,
                    sum(case when i.subtotal = 0 then 0 else round(i.total * l.quantity * (l.unit_price - l.discount) / i.subtotal) end) net,
                    sum(case when i.subtotal = 0 or i.total = 0 then 0
                             else round(i.total * l.quantity * (l.unit_price - l.discount) / i.subtotal * least(1, i.paid / i.total)) end) paid
                  from invoices i join invoice_lines l on l.invoice_id = i.id
                  where i.status = 'COMPLETED' and i.seller_id is not null and i.sold_at >= :from and i.sold_at < :to
                  group by 1, 2
                ), back as (
                  select coalesce(i.seller_id, r.created_by) seller_id, rl.product_id, max(rl.product_code) code,
                    max(rl.product_name) name, sum(rl.quantity) qty,
                    sum(case when r.subtotal = 0 then 0 else round(r.total * rl.quantity * rl.unit_price / r.subtotal) end) net,
                    sum(case when r.subtotal = 0 then 0 when i.id is null then round(r.total * rl.quantity * rl.unit_price / r.subtotal)
                             when i.total = 0 then 0
                             else round(r.total * rl.quantity * rl.unit_price / r.subtotal * least(1, i.paid / i.total)) end) paid
                  from sales_returns r left join invoices i on i.id = r.invoice_id join sales_return_lines rl on rl.return_id = r.id
                  where r.status = 'COMPLETED' and (r.invoice_id is null or i.seller_id is not null)
                    and r.returned_at >= :from and r.returned_at < :to
                  group by 1, 2
                )
                select coalesce(s.seller_id, b.seller_id) seller_id, coalesce(s.product_id, b.product_id) product_id,
                  coalesce(s.code, b.code) code, coalesce(s.name, b.name) name,
                  coalesce(s.qty, 0) - coalesce(b.qty, 0) qty, coalesce(s.net, 0) - coalesce(b.net, 0) net,
                  coalesce(s.paid, 0) - coalesce(b.paid, 0) paid
                from sale s full join back b on b.seller_id = s.seller_id and b.product_id = s.product_id
                order by 1, 3""", params, (rs, i) -> new SellerRevenue(rs.getObject("seller_id", UUID.class),
                rs.getObject("product_id", UUID.class), rs.getString("code"), rs.getString("name"), rs.getBigDecimal("qty"),
                rs.getBigDecimal("net"), rs.getBigDecimal("paid")));
    }
}
