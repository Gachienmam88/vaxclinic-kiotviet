package com.vaxclinic.integration.inputinvoice;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Item;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Page;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.io.IOException;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Đọc / gắn phiếu nhập cho hóa đơn đầu vào (input_invoices). Chỉ truy cập DB; ghi upsert ở {@link InputInvoiceWriteRepository}. */
@Repository
public class InputInvoiceRepository {

    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper json;

    public InputInvoiceRepository(NamedParameterJdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    /** receiptStatus: CREATED (đã lập phiếu) / NOT_CREATED / khác = mọi trạng thái. */
    public Page search(LocalDate from, LocalDate to, String q, String buyerTaxCode, String seller, String receiptStatus,
                       int page, int size) {
        var p = new MapSqlParameterSource();
        var w = new StringBuilder(" from input_invoices where 1=1");
        if (from != null) { w.append(" and issued_at >= :from"); p.addValue("from", from); }
        if (to != null) { w.append(" and issued_at <= :to"); p.addValue("to", to); }
        if (q != null && !q.isBlank()) { w.append(" and number ilike :q"); p.addValue("q", "%" + q.trim() + "%"); }
        if (buyerTaxCode != null && !buyerTaxCode.isBlank()) { w.append(" and buyer_tax_code = :buyer"); p.addValue("buyer", buyerTaxCode); }
        if (seller != null && !seller.isBlank()) {
            w.append(" and (seller_tax_code ilike :seller or seller_name ilike :seller)");
            p.addValue("seller", "%" + seller.trim() + "%");
        }
        if ("CREATED".equals(receiptStatus)) w.append(" and receipt_id is not null");
        if ("NOT_CREATED".equals(receiptStatus)) w.append(" and receipt_id is null");
        var agg = jdbc.queryForMap("select count(*) cnt, coalesce(sum(total),0) tot" + w, p);
        p.addValue("limit", Math.min(Math.max(size, 1), 100)).addValue("offset", (long) Math.max(page, 0) * size);
        var items = jdbc.query("select *" + w + " order by issued_at desc, number desc limit :limit offset :offset", p, this::toItem);
        return new Page(items, ((Number) agg.get("cnt")).longValue(), (BigDecimal) agg.get("tot"));
    }

    public Optional<Item> findById(UUID id) {
        return jdbc.query("select * from input_invoices where id = :id", new MapSqlParameterSource("id", id), this::toItem)
                .stream().findFirst();
    }

    public List<String> findBuyerTaxCodes() {
        return jdbc.getJdbcTemplate().queryForList("select distinct buyer_tax_code from input_invoices order by 1", String.class);
    }

    /** Trả số dòng đã sửa (0 = không có hóa đơn). */
    public int linkReceipt(UUID id, UUID receiptId, String receiptCode) {
        return jdbc.update("update input_invoices set receipt_id = :rid, receipt_code = :code where id = :id",
                new MapSqlParameterSource("rid", receiptId).addValue("code", receiptCode).addValue("id", id));
    }

    private Item toItem(ResultSet rs, int rowNum) throws SQLException {
        JsonNode lines;
        try {
            lines = rs.getString("lines") == null ? json.createArrayNode() : json.readTree(rs.getString("lines"));
        } catch (IOException e) {
            lines = json.createArrayNode();
        }
        return new Item(rs.getObject("id", UUID.class), rs.getString("buyer_tax_code"), rs.getString("seller_tax_code"),
                rs.getString("seller_name"), rs.getString("template_no"), rs.getString("series"), rs.getString("number"),
                rs.getDate("issued_at").toLocalDate(), rs.getBigDecimal("total_before_tax"), rs.getBigDecimal("vat_amount"),
                rs.getBigDecimal("total"), rs.getString("nature"), rs.getString("source"),
                rs.getObject("receipt_id", UUID.class), rs.getString("receipt_code"), lines);
    }
}
