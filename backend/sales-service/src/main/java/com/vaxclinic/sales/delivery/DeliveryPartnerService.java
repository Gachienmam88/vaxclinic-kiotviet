package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.PartnerRequest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** Thêm / sửa / xóa đối tác giao hàng. Đối tác đã có vận đơn hoặc công nợ thì không xóa — chuyển ngừng hoạt động. */
@Service
public class DeliveryPartnerService {

    private final DeliveryPartnerRepository partners;

    public DeliveryPartnerService(DeliveryPartnerRepository partners) {
        this.partners = partners;
    }

    @Transactional
    public UUID create(PartnerRequest r, Actor actor) {
        UUID id = UUID.randomUUID();
        String code = Actor.blankToNull(r.code()) != null ? r.code().trim().toUpperCase()
                : "DT%06d".formatted(partners.nextCodeNumber());
        try {
            partners.insert(id, code, r, type(r), actor.id());
        } catch (DuplicateKeyException e) {
            throw duplicate(code);
        }
        return id;
    }

    @Transactional
    public void update(UUID id, PartnerRequest r) {
        String code = partners.codeOf(id);
        if (code == null) {
            throw notFound();
        }
        String newCode = Actor.blankToNull(r.code()) == null ? code : r.code().trim().toUpperCase();
        try {
            partners.update(id, newCode, r, type(r));
        } catch (DuplicateKeyException e) {
            throw duplicate(newCode);
        }
    }

    /** Trả về mã đối tác đã xóa (ghi lịch sử thao tác). */
    @Transactional
    public String delete(UUID id) {
        var rows = partners.lockForDelete(id);
        if (rows.isEmpty()) {
            throw notFound();
        }
        Integer used = partners.countUsage(id);
        if (used != null && used > 0) {
            throw BusinessException.conflict("PARTNER_IN_USE",
                    "Đối tác đã có vận đơn / công nợ, không xóa được — hãy chuyển sang ngừng hoạt động");
        }
        partners.delete(id);
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
