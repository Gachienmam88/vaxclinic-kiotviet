package com.vaxclinic.sales.invoice;

import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceListItem;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceListResponse;
import com.vaxclinic.sales.invoice.InvoiceDtos.PaymentResponse;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** SQL đọc của màn hóa đơn: danh sách có lọc + dòng tổng, số đã trả theo dòng, lịch sử thanh toán, giá bán gần đây. */
@Repository
public class InvoiceQueryRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public InvoiceQueryRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Cột thêm của 1 dòng danh sách (sau i.*): khách, vận đơn s, đối tác giao hàng, mã đặt hàng / trả hàng, kênh bán. */
    static final String ITEM_COLUMNS = "select i.*, c.code customer_code, c.email customer_email, c.phone customer_phone,"
            + " c.address customer_address, c.province customer_province, c.ward customer_ward, c.birthday customer_birthday, "
            + InvoiceFilterSql.STATE + " state,"
            + " (select string_agg(r.code, ', ' order by r.created_at) from sales_returns r where r.invoice_id = i.id"
            + " and r.status = 'COMPLETED') return_codes,"
            + " (select o.code from customer_orders o where o.id = i.order_id) order_code,"
            + " (select ch.name from sales_channels ch where ch.code = i.sales_channel) channel_name,"
            + " s.id shipment_id, s.code shipment_code, s.status shipment_status, dp.name partner_name, s.cod_amount,"
            + " s.shipping_fee + s.return_fee partner_fee, s.expected_delivery_at";
    static final String ITEM_JOINS = " left join delivery_partners dp on dp.id = s.partner_id";

    /** einvoiceIds: id hóa đơn theo trạng thái HĐĐT (null = không lọc HĐĐT), xem {@link InvoiceFilterSql#where}. */
    public InvoiceListResponse search(InvoiceQuery.Filter f, Map<String, List<UUID>> einvoiceIds) {
        var p = new MapSqlParameterSource();
        String w = InvoiceFilterSql.where(f, p, einvoiceIds, ITEM_JOINS);
        var agg = jdbc.queryForMap("select count(*) cnt, coalesce(sum(i.subtotal),0) sub, coalesce(sum(i.discount),0) disc,"
                + " coalesce(sum(i.total),0) tot, coalesce(sum(i.paid),0) paid" + w, p);
        p.addValue("limit", f.size()).addValue("offset", (long) f.page() * f.size());
        var items = jdbc.query(ITEM_COLUMNS + w + " order by i.sold_at desc, i.code desc limit :limit offset :offset", p,
                (rs, n) -> item(rs));
        return new InvoiceListResponse(items, ((Number) agg.get("cnt")).longValue(), f.page(), f.size(),
                (BigDecimal) agg.get("sub"), (BigDecimal) agg.get("disc"), (BigDecimal) agg.get("tot"), (BigDecimal) agg.get("paid"));
    }

    private static InvoiceListItem item(ResultSet rs) throws SQLException {
        var birthday = rs.getDate("customer_birthday");
        return new InvoiceListItem(rs.getObject("id", UUID.class), rs.getString("code"),
                rs.getTimestamp("sold_at").toInstant(), rs.getString("customer_code"), rs.getString("customer_name"),
                rs.getString("seller_name"), rs.getBigDecimal("subtotal"), rs.getBigDecimal("discount"),
                rs.getBigDecimal("total"), rs.getBigDecimal("paid"), rs.getString("status"),
                rs.getString("payment_method"), rs.getString("state"), rs.getString("sale_mode"),
                rs.getString("return_codes"), instant(rs, "created_at"), instant(rs, "updated_at"), rs.getString("order_code"),
                rs.getString("customer_email"), rs.getString("customer_phone"), rs.getString("customer_address"),
                rs.getString("customer_province"), rs.getString("customer_ward"), birthday == null ? null : birthday.toLocalDate(),
                rs.getObject("branch_id", UUID.class), rs.getString("created_by_name"), rs.getString("channel_name"),
                rs.getString("note"), rs.getString("price_book_name"), rs.getObject("shipment_id", UUID.class),
                rs.getString("shipment_code"), rs.getString("shipment_status"), rs.getString("partner_name"),
                rs.getBigDecimal("cod_amount"), rs.getBigDecimal("partner_fee"), instant(rs, "expected_delivery_at"));
    }

    private static Instant instant(ResultSet rs, String col) throws SQLException {
        Timestamp t = rs.getTimestamp(col);
        return t == null ? null : t.toInstant();
    }

    /** Số lượng đã trả của từng dòng hóa đơn (phiếu trả hàng còn hiệu lực); dòng chưa trả không có trong map. */
    public Map<UUID, BigDecimal> returnedByLine(UUID invoiceId) {
        var returned = new HashMap<UUID, BigDecimal>();
        jdbc.query("""
                select rl.invoice_line_id, sum(rl.quantity) qty from sales_return_lines rl join sales_returns r on r.id = rl.return_id
                where r.invoice_id = :id and r.status = 'COMPLETED' group by rl.invoice_line_id""",
                new MapSqlParameterSource("id", invoiceId), rs -> {
                    returned.put(rs.getObject(1, UUID.class), rs.getBigDecimal(2));
                });
        return returned;
    }

    /** Các phiếu thu đã phân bổ vào hóa đơn, theo thời gian. */
    public List<PaymentResponse> payments(UUID invoiceId) {
        return jdbc.query("""
                select v.id, v.code, v.occurred_at, v.created_by_name, v.amount, v.fund, v.status, a.amount allocated
                from voucher_allocations a join cash_vouchers v on v.id = a.voucher_id
                where a.invoice_id = :id order by v.occurred_at""", new MapSqlParameterSource("id", invoiceId),
                (rs, n) -> new PaymentResponse(rs.getObject("id", UUID.class), rs.getString("code"),
                        rs.getTimestamp("occurred_at").toInstant(), rs.getString("created_by_name"),
                        rs.getBigDecimal("amount"), rs.getString("fund"), rs.getString("status"), rs.getBigDecimal("allocated")));
    }

    public String orderCode(UUID orderId) {
        return jdbc.queryForObject("select code from customer_orders where id = :id", new MapSqlParameterSource("id", orderId),
                String.class);
    }

    /** Tên kênh bán; kênh không còn thì trả lại mã. */
    public String channelName(String code) {
        return jdbc.queryForObject("select coalesce((select name from sales_channels where code = :c), :c)",
                new MapSqlParameterSource("c", code), String.class);
    }

    /** 10 lần bán gần nhất của 1 hàng; có khách thì lấy giá đã bán cho khách đó trước. */
    public List<InvoiceDtos.RecentPrice> recentPrices(UUID productId, UUID customerId) {
        var p = new MapSqlParameterSource("productId", productId).addValue("customerId", customerId);
        return jdbc.query("""
                select i.code, i.sold_at, i.customer_name, l.quantity, l.unit_price - l.discount price
                from invoice_lines l join invoices i on i.id = l.invoice_id
                where l.product_id = :productId and i.status = 'COMPLETED'
                order by (case when i.customer_id = cast(:customerId as uuid) then 0 else 1 end), i.sold_at desc
                limit 10""", p, (rs, n) -> new InvoiceDtos.RecentPrice(rs.getString("code"),
                rs.getTimestamp("sold_at").toInstant(), rs.getString("customer_name"), rs.getBigDecimal("quantity"),
                rs.getBigDecimal("price")));
    }
}
