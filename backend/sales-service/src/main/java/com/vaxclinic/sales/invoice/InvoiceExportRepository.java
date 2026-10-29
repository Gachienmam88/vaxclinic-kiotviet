package com.vaxclinic.sales.invoice;

import com.vaxclinic.sales.invoice.InvoiceExportDtos.ExportExtra;
import com.vaxclinic.sales.invoice.InvoiceExportDtos.ExportLine;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * SQL cho "Xuất file chi tiết": thanh toán tách theo hình thức, thông tin giao hàng của vận đơn hiện hành, dòng hàng + lô.
 * Thẻ = phiếu thu chính (TT{mã}) quỹ ngân hàng của hóa đơn thanh toán bằng thẻ; quỹ ngân hàng còn lại = Chuyển khoản.
 */
@Repository
public class InvoiceExportRepository {

    private static final String PAID_BY = "coalesce((select sum(a.amount) from voucher_allocations a"
            + " join cash_vouchers v on v.id = a.voucher_id where a.invoice_id = i.id and v.status = 'PAID' and ";
    private static final String MAIN_CARD = "(v.source_type = 'INVOICE' and i.payment_method = 'CARD')";

    private final NamedParameterJdbcTemplate jdbc;

    public InvoiceExportRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<ExportExtra> extras(List<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        String sql = "select i.id, " + PAID_BY + "v.fund = 'CASH'), 0) cash, "
                + PAID_BY + "v.fund = 'BANK' and " + MAIN_CARD + "), 0) card, "
                + PAID_BY + "v.fund = 'BANK' and not " + MAIN_CARD + "), 0) transfer, "
                + PAID_BY + "v.fund = 'EWALLET'), 0) ewallet,"
                + " s.receiver_name, s.receiver_phone, s.receiver_address, s.area, s.province_code, s.ward_code, s.service_type,"
                + " s.weight_gram, s.length_cm, s.width_cm, s.height_cm, s.note shipment_note,"
                + " (select g.note from shipment_status_logs g where g.shipment_id = s.id order by g.changed_at desc limit 1) status_note"
                + " from invoices i left join lateral (select sh.* from shipments sh where sh.invoice_id = i.id"
                + " and sh.status <> 'CANCELLED' order by sh.created_at desc limit 1) s on true where i.id in (:ids)";
        return jdbc.query(sql, new MapSqlParameterSource("ids", ids),
                (rs, n) -> new ExportExtra(rs.getObject("id", UUID.class), rs.getBigDecimal("cash"), rs.getBigDecimal("card"),
                        rs.getBigDecimal("transfer"), rs.getBigDecimal("ewallet"), rs.getString("receiver_name"),
                        rs.getString("receiver_phone"), rs.getString("receiver_address"), rs.getString("area"),
                        rs.getString("province_code"), rs.getString("ward_code"), rs.getString("service_type"),
                        (Integer) rs.getObject("weight_gram"), (Integer) rs.getObject("length_cm"),
                        (Integer) rs.getObject("width_cm"), (Integer) rs.getObject("height_cm"),
                        rs.getString("shipment_note"), rs.getString("status_note")));
    }

    /** Dòng hàng theo thứ tự hóa đơn; lots = các số lô đã xuất (bỏ hàng không theo lô), cách nhau ", ". */
    public List<ExportLine> lines(List<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        String sql = "select l.invoice_id, l.line_no, l.product_id, l.product_code, l.product_name, l.unit_name, l.quantity,"
                + " l.unit_price, l.discount, l.note, l.tax_code, (select string_agg(x.lot_number, ', ' order by x.lot_number)"
                + " from invoice_line_lots x where x.line_id = l.id and x.lot_number <> '') lots"
                + " from invoice_lines l where l.invoice_id in (:ids) order by l.invoice_id, l.line_no";
        return jdbc.query(sql, new MapSqlParameterSource("ids", ids), (rs, n) -> {
            var price = rs.getBigDecimal("unit_price").subtract(rs.getBigDecimal("discount"));
            return new ExportLine(rs.getObject("invoice_id", UUID.class), rs.getInt("line_no"),
                    rs.getObject("product_id", UUID.class), rs.getString("product_code"), rs.getString("product_name"),
                    rs.getString("unit_name"), rs.getBigDecimal("quantity"), rs.getBigDecimal("unit_price"),
                    rs.getBigDecimal("discount"), price, InvoiceMath.money(rs.getBigDecimal("quantity").multiply(price)),
                    rs.getString("lots"), rs.getString("note"), rs.getString("tax_code"));
        });
    }
}
