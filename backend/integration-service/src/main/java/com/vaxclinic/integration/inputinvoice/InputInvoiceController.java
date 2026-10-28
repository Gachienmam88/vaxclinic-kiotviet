package com.vaxclinic.integration.inputinvoice;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.common.error.BusinessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Hóa đơn đầu vào → "Danh sách hóa đơn": lọc, xem chi tiết, nhập file XML, đánh dấu đã lập phiếu nhập. */
@RestController
@PreAuthorize("hasAuthority('inventory.view')")
public class InputInvoiceController {

    public record Item(UUID id, String buyerTaxCode, String sellerTaxCode, String sellerName, String templateNo,
                       String series, String number, LocalDate issuedAt, BigDecimal totalBeforeTax, BigDecimal vatAmount,
                       BigDecimal total, String nature, String source, UUID receiptId, String receiptCode, JsonNode lines) {
    }

    public record Page(List<Item> items, long total, BigDecimal sumTotal) {
    }

    public record ReceiptLink(UUID receiptId, String receiptCode) {
    }

    private final NamedParameterJdbcTemplate jdbc;
    private final InputInvoiceStore store;
    private final ObjectMapper json;

    public InputInvoiceController(NamedParameterJdbcTemplate jdbc, InputInvoiceStore store, ObjectMapper json) {
        this.jdbc = jdbc;
        this.store = store;
        this.json = json;
    }

    @GetMapping("/api/input-invoices")
    public Page list(@RequestParam(required = false) LocalDate from, @RequestParam(required = false) LocalDate to,
                     @RequestParam(required = false) String q, @RequestParam(required = false) String buyerTaxCode,
                     @RequestParam(required = false) String seller, @RequestParam(required = false) String receiptStatus,
                     @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "15") int size) {
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
        var items = jdbc.query("select *" + w + " order by issued_at desc, number desc limit :limit offset :offset", p, (rs, n) -> {
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
        });
        return new Page(items, ((Number) agg.get("cnt")).longValue(), (BigDecimal) agg.get("tot"));
    }

    @GetMapping("/api/input-invoices/{id}")
    public Item get(@PathVariable UUID id) {
        var page = list(null, null, null, null, null, null, 0, 1); // reuse mapping
        var rows = jdbc.query("select id from input_invoices where id = :id", new MapSqlParameterSource("id", id),
                (rs, n) -> rs.getObject("id", UUID.class));
        if (rows.isEmpty()) {
            throw BusinessException.notFound("INPUT_INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn đầu vào");
        }
        return byId(id);
    }

    private Item byId(UUID id) {
        return jdbc.query("select * from input_invoices where id = :id", new MapSqlParameterSource("id", id), (rs, n) -> {
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
        }).get(0);
    }

    @GetMapping("/api/input-invoices/buyer-tax-codes")
    public List<String> buyerTaxCodes() {
        return jdbc.getJdbcTemplate().queryForList("select distinct buyer_tax_code from input_invoices order by 1", String.class);
    }

    /** Nhập 1 hoặc nhiều file XML hóa đơn tải từ cổng thuế. */
    @PostMapping("/api/input-invoices/import")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public Map<String, Object> importXml(@RequestParam("files") List<MultipartFile> files) throws IOException {
        int added = 0;
        var errors = new java.util.ArrayList<String>();
        for (MultipartFile f : files) {
            try {
                var parsed = EInvoiceXmlParser.parse(f.getBytes());
                if (store.upsert(parsed, parsed.buyerTaxCode() == null ? "" : parsed.buyerTaxCode(), "XML")) {
                    added++;
                }
            } catch (BusinessException e) {
                errors.add(f.getOriginalFilename() + ": " + e.getMessage());
            }
        }
        return Map.of("files", files.size(), "added", added, "errors", errors);
    }

    /** Gắn phiếu nhập đã lập từ hóa đơn này (trạng thái "Đã lập phiếu"). */
    @PatchMapping("/api/input-invoices/{id}/receipt")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public void linkReceipt(@PathVariable UUID id, @RequestBody ReceiptLink link) {
        int n = jdbc.update("update input_invoices set receipt_id = :rid, receipt_code = :code where id = :id",
                new MapSqlParameterSource("rid", link.receiptId()).addValue("code", link.receiptCode()).addValue("id", id));
        if (n == 0) {
            throw BusinessException.notFound("INPUT_INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn đầu vào");
        }
    }
}
