package com.vaxclinic.integration.inputinvoice;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.sql.Date;
import java.util.List;
import java.util.UUID;

/**
 * Ghi hóa đơn đầu vào: upsert theo (MST bán, mẫu số, ký hiệu, số) → đồng bộ lại / nhập lại file không tạo trùng,
 * và không làm mất liên kết "đã lập phiếu nhập".
 */
@Component
public class InputInvoiceStore {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public InputInvoiceStore(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    /** @return true nếu là hóa đơn mới */
    public boolean upsert(EInvoiceXmlParser.Parsed p, String buyerTaxCode, String source) {
        String lines;
        try {
            lines = json.writeValueAsString(p.lines());
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
        int inserted = jdbc.update("""
                insert into input_invoices(id, buyer_tax_code, seller_tax_code, seller_name, seller_address, template_no,
                    series, number, issued_at, total_before_tax, vat_amount, total, nature, source, lines)
                values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                on conflict (seller_tax_code, template_no, series, number) do nothing""",
                UUID.randomUUID(), buyerTaxCode, p.sellerTaxCode(), p.sellerName(), p.sellerAddress(),
                p.templateNo() == null ? "" : p.templateNo(), p.series(), p.number(), Date.valueOf(p.issuedAt()),
                p.totalBeforeTax(), p.vatAmount(), p.total(), p.nature(), source, lines);
        if (inserted == 0) { // đã có: cập nhật số liệu (bản XML có thể đầy đủ hơn bản cổng), giữ receipt_*
            jdbc.update("""
                    update input_invoices set seller_name = coalesce(?, seller_name), total_before_tax = coalesce(?, total_before_tax),
                        vat_amount = coalesce(?, vat_amount), total = ?, lines = case when ? = '[]' then lines else ? end
                    where seller_tax_code = ? and template_no = ? and series = ? and number = ?""",
                    p.sellerName(), p.totalBeforeTax(), p.vatAmount(), p.total(), lines, lines, p.sellerTaxCode(),
                    p.templateNo() == null ? "" : p.templateNo(), p.series(), p.number());
        }
        return inserted > 0;
    }

    /** Chuyển 1 dòng JSON của cổng thuế (danh sách + chi tiết) về cùng dạng với hóa đơn đọc từ XML. */
    public static EInvoiceXmlParser.Parsed fromPortal(com.fasterxml.jackson.databind.JsonNode s,
                                                      com.fasterxml.jackson.databind.JsonNode detail) {
        var lines = new java.util.ArrayList<EInvoiceXmlParser.Line>();
        if (detail != null) {
            detail.path("hdhhdvu").forEach(l -> lines.add(new EInvoiceXmlParser.Line(text(l, "mhhdvu"), text(l, "ten"),
                    text(l, "dvtinh"), dec(l, "sluong"), dec(l, "dgia"), dec(l, "stckhau"), dec(l, "thtien"), text(l, "ltsuat"))));
        }
        String tchat = s.path("tchat").asText("");
        return new EInvoiceXmlParser.Parsed(s.path("khmshdon").asText(""), s.path("khhdon").asText(), s.path("shdon").asText(),
                java.time.OffsetDateTime.parse(s.path("tdlap").asText()).toLocalDate(), s.path("nbmst").asText(),
                text(s, "nbten"), text(s, "nbdchi"), text(s, "nmmst"), dec(s, "tgtcthue"), dec(s, "tgtthue"),
                dec(s, "tgtttbso") == null ? BigDecimal.ZERO : dec(s, "tgtttbso"),
                "2".equals(tchat) ? "ADJUST" : "3".equals(tchat) ? "REPLACE" : "ORIGINAL", List.copyOf(lines));
    }

    private static String text(com.fasterxml.jackson.databind.JsonNode n, String f) {
        return n.hasNonNull(f) ? n.get(f).asText() : null;
    }

    private static BigDecimal dec(com.fasterxml.jackson.databind.JsonNode n, String f) {
        return n.hasNonNull(f) ? n.get(f).decimalValue() : null;
    }
}
