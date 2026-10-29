package com.vaxclinic.product.internal;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.product.internal.InternalStockService.StockDocResult;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Bảng external_stock_docs: kết quả trừ / hoàn kho đã áp cho chứng từ sales-service, lưu JSON theo (docId, docType)
 * → khóa idempotent của {@link InternalStockService}. Chỉ truy cập DB.
 */
@Repository
public class ExternalStockDocRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public ExternalStockDocRepository(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    /** Kết quả đã lưu của docId thuộc 1 trong docTypes; null nếu chưa có. */
    public StockDocResult find(UUID docId, List<String> docTypes) {
        var rows = jdbc.queryForList("select result from external_stock_docs where doc_id = ? and doc_type = any(?)",
                String.class, docId, docTypes.toArray(String[]::new));
        if (rows.isEmpty()) {
            return null;
        }
        try {
            return json.readValue(rows.get(0), StockDocResult.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    public void insert(UUID docId, String docType, String docCode, StockDocResult result) {
        try {
            jdbc.update("insert into external_stock_docs(doc_id, doc_type, doc_code, result) values (?,?,?,?)",
                    docId, docType, docCode, json.writeValueAsString(result));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
