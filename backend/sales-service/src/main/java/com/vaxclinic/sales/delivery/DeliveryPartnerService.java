package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.address.AdminUnitCodes;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.PartnerRequest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** Thêm / sửa / xóa đối tác giao hàng. Đối tác đã có vận đơn hoặc công nợ thì không xóa — chuyển ngừng hoạt động. */
@Service
public class DeliveryPartnerService {

    private final JdbcTemplate jdbc;

    public DeliveryPartnerService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public UUID create(PartnerRequest r, Actor actor) {
        UUID id = UUID.randomUUID();
        String code = Actor.blankToNull(r.code()) != null ? r.code().trim().toUpperCase()
                : "DT%06d".formatted(jdbc.queryForObject("select nextval('delivery_partner_code_seq')", Long.class));
        try {
            jdbc.update("""
                    insert into delivery_partners(id, code, name, phone, email, address, note, partner_type, active, created_by,
                        province, ward, province_code, ward_code)
                    values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", id, code, r.name().trim(), Actor.blankToNull(r.phone()),
                    Actor.blankToNull(r.email()), Actor.blankToNull(r.address()), Actor.blankToNull(r.note()), type(r),
                    r.active() == null || r.active(), actor.id(), Actor.blankToNull(r.province()), Actor.blankToNull(r.ward()),
                    AdminUnitCodes.clean(r.provinceCode()), AdminUnitCodes.clean(r.wardCode()));
        } catch (DuplicateKeyException e) {
            throw duplicate(code);
        }
        return id;
    }

    @Transactional
    public void update(UUID id, PartnerRequest r) {
        String code = jdbc.query("select code from delivery_partners where id = ?", rs -> rs.next() ? rs.getString(1) : null, id);
        if (code == null) {
            throw notFound();
        }
        String newCode = Actor.blankToNull(r.code()) == null ? code : r.code().trim().toUpperCase();
        try {
            jdbc.update("""
                    update delivery_partners set code = ?, name = ?, phone = ?, email = ?, address = ?, note = ?, partner_type = ?,
                        active = ?, province = ?, ward = ?, province_code = ?, ward_code = ? where id = ?""", newCode, r.name().trim(),
                    Actor.blankToNull(r.phone()), Actor.blankToNull(r.email()), Actor.blankToNull(r.address()),
                    Actor.blankToNull(r.note()), type(r), r.active() == null || r.active(), Actor.blankToNull(r.province()),
                    Actor.blankToNull(r.ward()), AdminUnitCodes.clean(r.provinceCode()), AdminUnitCodes.clean(r.wardCode()), id);
        } catch (DuplicateKeyException e) {
            throw duplicate(newCode);
        }
    }

    /** Trả về mã đối tác đã xóa (ghi lịch sử thao tác). */
    @Transactional
    public String delete(UUID id) {
        var rows = jdbc.queryForList("select code, debt from delivery_partners where id = ? for update", id);
        if (rows.isEmpty()) {
            throw notFound();
        }
        Integer used = jdbc.queryForObject("select (select count(*) from shipments where partner_id = ?)"
                + " + (select count(*) from delivery_partner_ledger where partner_id = ?)", Integer.class, id, id);
        if (used != null && used > 0) {
            throw BusinessException.conflict("PARTNER_IN_USE",
                    "Đối tác đã có vận đơn / công nợ, không xóa được — hãy chuyển sang ngừng hoạt động");
        }
        jdbc.update("delete from delivery_partners where id = ?", id);
        return (String) rows.get(0).get("code");
    }

    private static String type(PartnerRequest r) {
        return r.partnerType() == null ? "MANUAL" : r.partnerType();
    }

    static BusinessException notFound() {
        return BusinessException.notFound("PARTNER_NOT_FOUND", "Không tìm thấy đối tác giao hàng");
    }

    private static BusinessException duplicate(String code) {
        return BusinessException.conflict("PARTNER_CODE_DUPLICATE", "Mã đối tác " + code + " đã tồn tại");
    }
}
