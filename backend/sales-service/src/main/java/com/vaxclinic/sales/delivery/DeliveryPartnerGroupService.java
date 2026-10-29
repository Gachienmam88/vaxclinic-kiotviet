package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.GroupRequest;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.GroupRow;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/** Nhóm đối tác giao hàng: danh sách + thêm nhóm (tên không trùng, không phân biệt hoa thường). */
@Service
public class DeliveryPartnerGroupService {

    private final DeliveryPartnerGroupRepository groups;
    private final AuditLogger audit;

    public DeliveryPartnerGroupService(DeliveryPartnerGroupRepository groups, AuditLogger audit) {
        this.groups = groups;
        this.audit = audit;
    }

    public List<GroupRow> list() {
        return groups.list();
    }

    public GroupRow create(GroupRequest req, Actor actor) {
        String name = req.name().trim().replaceAll("\\s+", " ");
        UUID id = UUID.randomUUID();
        try {
            groups.insert(id, name, actor.id());
        } catch (DuplicateKeyException e) {
            throw BusinessException.conflict("PARTNER_GROUP_DUPLICATE", "Nhóm đối tác " + name + " đã tồn tại");
        }
        actor.audit(audit, null, "Đối tác giao hàng", "Tạo", null, "Tạo nhóm đối tác giao hàng " + name);
        return new GroupRow(id, name, 0);
    }
}
