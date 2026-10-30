package com.vaxclinic.integration.inputinvoice;

import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.ItemMapping;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

/** Ánh xạ đã nhớ "hàng trên hóa đơn của NCC (MST bán + tên + ĐVT)" → hàng hóa + đơn vị (input_invoice_item_mappings). */
@Repository
public class InputInvoiceMappingRepository {

    private final JdbcTemplate jdbc;

    public InputInvoiceMappingRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Khóa so khớp: tên + "|" + ĐVT, chữ thường, gộp khoảng trắng (cùng quy tắc với FE). */
    public static String key(String name, String unit) {
        return norm(name) + "|" + norm(unit);
    }

    private static String norm(String s) {
        return s == null ? "" : s.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    public List<ItemMapping> find(String sellerTaxCode) {
        return jdbc.query("""
                select item_name, item_unit, product_id, unit_id from input_invoice_item_mappings
                where seller_tax_code = ? order by item_name""", (rs, n) -> new ItemMapping(rs.getString(1), rs.getString(2),
                rs.getObject(3, UUID.class), rs.getObject(4, UUID.class)), sellerTaxCode);
    }

    public void upsert(String sellerTaxCode, ItemMapping m, UUID userId) {
        jdbc.update("""
                insert into input_invoice_item_mappings(seller_tax_code, item_key, item_name, item_unit, product_id, unit_id, updated_by)
                values (?, ?, ?, ?, ?, ?, ?)
                on conflict (seller_tax_code, item_key) do update set item_name = excluded.item_name,
                  item_unit = excluded.item_unit, product_id = excluded.product_id, unit_id = excluded.unit_id,
                  updated_by = excluded.updated_by, updated_at = now()""",
                sellerTaxCode, key(m.itemName(), m.itemUnit()), m.itemName().trim(), m.itemUnit() == null ? null : m.itemUnit().trim(),
                m.productId(), m.unitId(), userId);
    }
}
