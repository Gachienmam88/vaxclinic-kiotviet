package com.vaxclinic.integration.inputinvoice;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Filter;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Item;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Page;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Seller;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.io.IOException;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Đọc / gắn chứng từ đã lập cho hóa đơn đầu vào (input_invoices). Chỉ truy cập DB; ghi upsert ở {@link InputInvoiceWriteRepository}. */
@Repository
public class InputInvoiceRepository {

    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper json;

    public InputInvoiceRepository(NamedParameterJdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public Page search(Filter f, int page, int size) {
        var p = new MapSqlParameterSource();
        String w = where(f, p);
        var agg = jdbc.queryForMap("select count(*) cnt, coalesce(sum(total),0) tot" + w, p);
        int limit = Math.min(Math.max(size, 1), 100);
        p.addValue("limit", limit).addValue("offset", (long) Math.max(page, 0) * limit);
        var items = jdbc.query("select *" + w + " order by issued_at desc, number desc limit :limit offset :offset", p,
                (rs, n) -> toItem(rs, false));
        return new Page(items, ((Number) agg.get("cnt")).longValue(), (BigDecimal) agg.get("tot"));
    }

    /** Xuất file: mọi hóa đơn khớp bộ lọc (tối đa max dòng), không kèm dòng hàng. */
    public List<Item> export(Filter f, int max) {
        var p = new MapSqlParameterSource();
        String w = where(f, p);
        p.addValue("limit", max);
        return jdbc.query("select *" + w + " order by issued_at desc, number desc limit :limit", p, (rs, n) -> toItem(rs, false));
    }

    private static String where(Filter f, MapSqlParameterSource p) {
        var w = new StringBuilder(" from input_invoices where 1=1");
        if (f.from() != null) { w.append(" and issued_at >= :from"); p.addValue("from", f.from()); }
        if (f.to() != null) { w.append(" and issued_at <= :to"); p.addValue("to", f.to()); }
        if (f.q() != null && !f.q().isBlank()) { w.append(" and number ilike :q"); p.addValue("q", "%" + f.q().trim() + "%"); }
        if (f.buyerTaxCode() != null && !f.buyerTaxCode().isBlank()) {
            w.append(" and buyer_tax_code = :buyer");
            p.addValue("buyer", f.buyerTaxCode());
        }
        if (f.seller() != null && !f.seller().isBlank()) {
            w.append(" and (seller_tax_code ilike :seller or seller_name ilike :seller)");
            p.addValue("seller", "%" + f.seller().trim() + "%");
        }
        if (f.sellerTaxCode() != null && !f.sellerTaxCode().isBlank()) {
            w.append(" and seller_tax_code = :sellerTaxCode");
            p.addValue("sellerTaxCode", f.sellerTaxCode().trim());
        }
        if (f.natures() != null && !f.natures().isEmpty()) {
            w.append(" and nature in (:natures)");
            p.addValue("natures", f.natures());
        }
        if ("CREATED".equals(f.receiptStatus())) w.append(" and link_id is not null");
        if ("NOT_CREATED".equals(f.receiptStatus())) w.append(" and link_id is null");
        return w.toString();
    }

    public Optional<Item> findById(UUID id) {
        return jdbc.query("select * from input_invoices where id = :id", new MapSqlParameterSource("id", id),
                (rs, n) -> toItem(rs, true)).stream().findFirst();
    }

    public List<String> findBuyerTaxCodes() {
        return jdbc.getJdbcTemplate().queryForList("select distinct buyer_tax_code from input_invoices order by 1", String.class);
    }

    /** Người bán đã có hóa đơn (ô lọc "Nhà cung cấp"): MST + tên gần nhất. */
    public List<Seller> findSellers() {
        return jdbc.getJdbcTemplate().query("""
                select distinct on (seller_tax_code) seller_tax_code, seller_name from input_invoices
                order by seller_tax_code, issued_at desc""", (rs, n) -> new Seller(rs.getString(1), rs.getString(2)));
    }

    /** link_type, link_id, link_code hiện tại (null nếu chưa lập phiếu); rỗng nếu không có hóa đơn. */
    public Optional<Object[]> findLink(UUID id) {
        return jdbc.query("select link_type, link_id, link_code from input_invoices where id = :id for update",
                new MapSqlParameterSource("id", id), (rs, n) -> new Object[]{rs.getString(1), rs.getObject(2, UUID.class),
                        rs.getString(3)}).stream().findFirst();
    }

    public void setLink(UUID id, String type, UUID linkId, String code) {
        jdbc.update("update input_invoices set link_type = :type, link_id = :lid, link_code = :code where id = :id",
                new MapSqlParameterSource("type", type).addValue("lid", linkId).addValue("code", code).addValue("id", id));
    }

    /** Bỏ "Đã lập phiếu" của mọi hóa đơn trỏ tới chứng từ linkId (chứng từ đã hủy). Trả số hóa đơn đã bỏ. */
    public int unlinkDoc(UUID linkId) {
        return jdbc.update("update input_invoices set link_type = null, link_id = null, link_code = null where link_id = :lid",
                new MapSqlParameterSource("lid", linkId));
    }

    private Item toItem(ResultSet rs, boolean withDetails) throws SQLException {
        String type = rs.getString("link_type");
        UUID linkId = rs.getObject("link_id", UUID.class);
        String linkCode = rs.getString("link_code");
        boolean receipt = "RECEIPT".equals(type);
        BigDecimal total = rs.getBigDecimal("total");
        return new Item(rs.getObject("id", UUID.class), rs.getString("buyer_tax_code"), rs.getString("seller_tax_code"),
                rs.getString("seller_name"), rs.getString("seller_address"), rs.getString("template_no"),
                rs.getString("series"), rs.getString("number"), rs.getDate("issued_at").toLocalDate(),
                rs.getBigDecimal("total_before_tax"), rs.getBigDecimal("vat_amount"), total, rs.getString("nature"),
                rs.getString("source"), type, linkId, linkCode, receipt ? linkId : null, receipt ? linkCode : null,
                parse(rs.getString("lines"), true), withDetails ? parse(rs.getString("details"), false) : null,
                withDetails ? com.vaxclinic.integration.einvoice.VietnameseAmountInWords.of(total.longValue()) : null);
    }

    private JsonNode parse(String text, boolean array) {
        try {
            return text == null ? (array ? json.createArrayNode() : null) : json.readTree(text);
        } catch (IOException e) {
            return array ? json.createArrayNode() : null;
        }
    }
}
