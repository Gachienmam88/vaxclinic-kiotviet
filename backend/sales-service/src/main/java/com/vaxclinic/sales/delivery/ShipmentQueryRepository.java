package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.delivery.ShipmentDtos.ShipmentDetail;
import com.vaxclinic.sales.delivery.ShipmentDtos.ShipmentListItem;
import com.vaxclinic.sales.delivery.ShipmentDtos.ShipmentListResponse;
import com.vaxclinic.sales.delivery.ShipmentDtos.StatusLog;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;

/** Danh sách vận đơn (Quản lý giao hàng / Vận đơn): bộ lọc, dòng tổng, số vận đơn theo trạng thái; chi tiết + lịch sử. */
@Repository
public class ShipmentQueryRepository {

    /** branches: đã giao với chi nhánh người dùng; from/to theo thời gian tạo vận đơn. */
    /** provinceCode: lọc theo mã tỉnh; vận đơn cũ chưa có mã thì khớp theo tên (area). */
    /** completedFrom/To: thời gian hoàn thành (delivered_at); cod: có / không thu hộ; connection: MANUAL = tự giao hàng. */
    public record Filter(String q, List<String> statuses, UUID partnerId, String area, String provinceCode, Instant from,
                         Instant to, List<UUID> branches, Boolean reconciled, int page, int size, Instant completedFrom,
                         Instant completedTo, Boolean cod, String connection) {
    }

    private static final String FROM = " from shipments s join invoices i on i.id = s.invoice_id"
            + " join delivery_partners p on p.id = s.partner_id left join customers c on c.id = i.customer_id"
            + " where s.branch_id in (:branches)";
    private static final String COLS = "select s.*, i.code invoice_code, i.customer_name, i.customer_id, c.code customer_code,"
            + " p.name partner_name";

    private final NamedParameterJdbcTemplate jdbc;

    public ShipmentQueryRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public ShipmentListResponse search(Filter f) {
        var p = new MapSqlParameterSource("branches", f.branches().isEmpty() ? List.of(new UUID(0, 0)) : f.branches());
        var w = new StringBuilder(FROM);
        if (f.q() != null && !f.q().isBlank()) {
            w.append(" and (s.code ilike :q or s.waybill_code ilike :q or i.code ilike :q or s.receiver_name ilike :q"
                    + " or s.receiver_phone ilike :q or i.customer_name ilike :q)");
            p.addValue("q", "%" + f.q().trim() + "%");
        }
        if (f.partnerId() != null) {
            w.append(" and s.partner_id = :partner");
            p.addValue("partner", f.partnerId());
        }
        boolean byArea = f.area() != null && !f.area().isBlank();
        if (byArea) {
            p.addValue("area", "%" + f.area().trim() + "%");
        }
        String areaMatch = "(s.area ilike :area or s.receiver_address ilike :area)";
        if (f.provinceCode() != null && !f.provinceCode().isBlank()) {
            w.append(" and (s.province_code = :province").append(byArea ? " or (s.province_code is null and " + areaMatch + "))" : ")");
            p.addValue("province", f.provinceCode().trim());
        } else if (byArea) {
            w.append(" and ").append(areaMatch);
        }
        if (f.from() != null) {
            w.append(" and s.created_at >= :from");
            p.addValue("from", Timestamp.from(f.from()));
        }
        if (f.to() != null) {
            w.append(" and s.created_at < :to");
            p.addValue("to", Timestamp.from(f.to()));
        }
        if (f.completedFrom() != null) {
            w.append(" and s.delivered_at >= :cfrom");
            p.addValue("cfrom", Timestamp.from(f.completedFrom()));
        }
        if (f.completedTo() != null) {
            w.append(" and s.delivered_at < :cto");
            p.addValue("cto", Timestamp.from(f.completedTo()));
        }
        if (f.cod() != null) w.append(f.cod() ? " and s.cod_amount > 0" : " and s.cod_amount = 0");
        if (f.connection() != null && !f.connection().isBlank()) {
            w.append(" and p.partner_type = :conn");
            p.addValue("conn", f.connection());
        }
        if (f.reconciled() != null) w.append(f.reconciled() ? " and s.settlement_id is not null" : " and s.settlement_id is null");
        // Số vận đơn theo trạng thái: theo mọi bộ lọc trừ trạng thái (thanh tab đếm như KiotViet)
        var counts = new LinkedHashMap<String, Long>();
        ShipmentStatus.LABELS.keySet().forEach(k -> counts.put(k, 0L));
        jdbc.query("select s.status, count(*) n" + w + " group by s.status", p,
                rs -> { counts.put(rs.getString(1), rs.getLong(2)); });
        if (f.statuses() != null && !f.statuses().isEmpty()) {
            w.append(" and s.status in (:statuses)");
            p.addValue("statuses", f.statuses());
        }
        var agg = jdbc.queryForMap("select count(*) n, coalesce(sum(s.shipping_fee), 0) fee, coalesce(sum(s.cod_amount), 0) cod" + w, p);
        p.addValue("limit", f.size()).addValue("offset", (long) f.page() * f.size());
        var items = jdbc.query(COLS + w
                + " order by s.created_at desc limit :limit offset :offset", p, (rs, n) -> item(rs));
        return new ShipmentListResponse(items, ((Number) agg.get("n")).longValue(), f.page(), f.size(),
                (BigDecimal) agg.get("fee"), (BigDecimal) agg.get("cod"), counts);
    }

    public ShipmentDetail detail(UUID id, List<UUID> branches) {
        var p = new MapSqlParameterSource("id", id).addValue("branches", branches.isEmpty() ? List.of(new UUID(0, 0)) : branches);
        var rows = jdbc.query("""
                select s.*, i.code invoice_code, i.customer_name, i.customer_id, c.code customer_code, i.total invoice_total,
                  i.paid invoice_paid, i.note invoice_note, p.name partner_name,
                  (select coalesce(sum(l.quantity), 0) from invoice_lines l where l.invoice_id = i.id) item_qty,
                  (select r.code from sales_returns r where r.id = s.return_id) return_code,
                  (select d.code from delivery_settlements d where d.id = s.settlement_id) settlement_code""" + FROM
                + " and s.id = :id", p, (rs, n) -> new ShipmentDetail(item(rs), (Integer) rs.getObject("weight_gram"),
                rs.getString("note"), instant(rs, "delivered_at"), rs.getObject("return_id", UUID.class), rs.getString("return_code"),
                rs.getString("settlement_code"), rs.getString("created_by_name"), rs.getBigDecimal("invoice_total"),
                rs.getBigDecimal("invoice_paid"), rs.getBigDecimal("fee_posted"), rs.getBigDecimal("return_fee"), List.of(),
                rs.getBigDecimal("item_qty"), rs.getString("invoice_note"), rs.getInt("package_count"),
                (Integer) rs.getObject("length_cm"), (Integer) rs.getObject("width_cm"), (Integer) rs.getObject("height_cm"),
                codOpen(rs), partnerFee(rs), rs.getObject("settlement_id") != null ? BigDecimal.ZERO : partnerFee(rs)));
        if (rows.isEmpty()) {
            throw BusinessException.notFound("SHIPMENT_NOT_FOUND", "Không tìm thấy vận đơn");
        }
        var logs = jdbc.query("select * from shipment_status_logs where shipment_id = :id order by changed_at, id", p,
                (rs, n) -> new StatusLog(rs.getString("from_status"), rs.getString("to_status"), rs.getString("note"),
                        rs.getString("changed_by_name"), rs.getTimestamp("changed_at").toInstant()));
        var d = rows.get(0);
        return new ShipmentDetail(d.item(), d.weightGram(), d.note(), d.deliveredAt(), d.returnId(), d.returnCode(),
                d.settlementCode(), d.createdByName(), d.invoiceTotal(), d.invoicePaid(), d.feePosted(), d.returnFee(), logs,
                d.itemQuantity(), d.invoiceNote(), d.packageCount(), d.lengthCm(), d.widthCm(), d.heightCm(), d.codOpen(),
                d.partnerFee(), d.partnerFeeOpen());
    }

    private static ShipmentListItem item(ResultSet rs) throws SQLException {
        return new ShipmentListItem(rs.getObject("id", UUID.class), rs.getString("code"), instant(rs, "created_at"),
                rs.getObject("invoice_id", UUID.class), rs.getString("invoice_code"), rs.getString("customer_name"),
                rs.getString("receiver_name"), rs.getString("receiver_phone"), rs.getString("receiver_address"),
                rs.getString("area"), rs.getObject("partner_id", UUID.class), rs.getString("partner_name"),
                rs.getBigDecimal("shipping_fee"), rs.getString("fee_payer"), rs.getBigDecimal("cod_amount"),
                rs.getString("status"), rs.getObject("settlement_id") != null, rs.getObject("branch_id", UUID.class),
                rs.getString("province_code"), rs.getString("ward_code"), rs.getObject("customer_id", UUID.class),
                rs.getString("customer_code"), rs.getString("waybill_code"), instant(rs, "expected_delivery_at"),
                instant(rs, "delivered_at"), rs.getString("service_type"));
    }

    /** Thu hộ còn cần thu: đã hủy / chuyển hoàn / đã đối soát → 0; đã ghi sổ → số đã ghi; chưa giao xong → thu hộ dự kiến. */
    private static BigDecimal codOpen(ResultSet rs) throws SQLException {
        if (rs.getObject("settlement_id") != null || "CANCELLED".equals(rs.getString("status"))
                || ShipmentStatus.returning(rs.getString("status"))) {
            return BigDecimal.ZERO;
        }
        BigDecimal posted = rs.getBigDecimal("cod_posted");
        return posted != null ? posted : rs.getBigDecimal("cod_amount");
    }

    /** Phí trả ĐTGH: đã ghi sổ (giao thành công / chuyển hoàn) hoặc phí giao dự kiến khi cửa hàng trả; đã hủy → 0. */
    private static BigDecimal partnerFee(ResultSet rs) throws SQLException {
        BigDecimal posted = rs.getBigDecimal("fee_posted");
        if (posted != null) {
            return posted;
        }
        return "CANCELLED".equals(rs.getString("status")) || !"SHOP".equals(rs.getString("fee_payer"))
                ? BigDecimal.ZERO : rs.getBigDecimal("shipping_fee");
    }

    private static Instant instant(ResultSet rs, String col) throws SQLException {
        Timestamp t = rs.getTimestamp(col);
        return t == null ? null : t.toInstant();
    }
}
