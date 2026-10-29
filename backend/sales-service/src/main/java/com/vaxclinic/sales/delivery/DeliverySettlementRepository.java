package com.vaxclinic.sales.delivery;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Phiếu đối soát / thanh toán đối tác giao hàng (delivery_settlements) + gắn / gỡ vận đơn khỏi phiếu. */
@Repository
public class DeliverySettlementRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public DeliverySettlementRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Khóa các vận đơn sẽ đối soát (chỉ trả về vận đơn tồn tại). */
    public List<Map<String, Object>> lockShipments(List<UUID> ids) {
        return jdbc.queryForList("select * from shipments where id in (:ids) for update",
                new MapSqlParameterSource("ids", ids));
    }

    public void attachShipments(UUID settlementId, List<UUID> ids) {
        jdbc.update("update shipments set settlement_id = :sid, updated_at = now() where id in (:ids)",
                new MapSqlParameterSource("sid", settlementId).addValue("ids", ids));
    }

    /** Khóa phiếu (rỗng = không có). */
    public List<Map<String, Object>> lock(UUID id) {
        return jdbc.queryForList("select * from delivery_settlements where id = :id for update",
                new MapSqlParameterSource("id", id));
    }

    /** Phiếu → Đã hủy, vận đơn của phiếu quay lại chờ đối soát. */
    public void cancel(UUID id) {
        var p = new MapSqlParameterSource("id", id);
        jdbc.update("update delivery_settlements set status = 'CANCELLED', cancelled_at = now() where id = :id", p);
        jdbc.update("update shipments set settlement_id = null, updated_at = now() where settlement_id = :id", p);
    }

    public Long nextCodeNumber() {
        return jdbc.getJdbcTemplate().queryForObject("select nextval('delivery_settlement_code_seq')", Long.class);
    }

    public void insert(UUID id, String code, UUID partnerId, UUID branchId, String kind, BigDecimal cod, BigDecimal fee,
                       BigDecimal amount, int count, UUID voucherId, String note, UUID createdBy, String createdByName) {
        jdbc.update("""
                insert into delivery_settlements(id, code, partner_id, branch_id, kind, cod_total, fee_total, amount, shipment_count,
                    voucher_id, note, created_by, created_by_name) values (:id, :code, :partner, :branch, :kind, :cod, :fee, :amount,
                    :count, :voucher, :note, :by, :byName)""", new MapSqlParameterSource("id", id).addValue("code", code)
                .addValue("partner", partnerId).addValue("branch", branchId).addValue("kind", kind).addValue("cod", cod)
                .addValue("fee", fee).addValue("amount", amount).addValue("count", count).addValue("voucher", voucherId)
                .addValue("note", note).addValue("by", createdBy).addValue("byName", createdByName));
    }
}
