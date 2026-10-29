package com.vaxclinic.sales.customer;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.customer.CustomerGroupService.GroupRequest;
import com.vaxclinic.sales.customer.CustomerGroupService.GroupResponse;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Nhóm khách hàng cho màn hình: gọi {@link CustomerGroupService} rồi ghi lịch sử thao tác (sau khi đã commit). */
@Service
public class CustomerGroupManageService {

    private static final String FEATURE = "Nhóm khách hàng";

    private final CustomerGroupService service;
    private final AuditLogger audit;

    public CustomerGroupManageService(CustomerGroupService service, AuditLogger audit) {
        this.service = service;
        this.audit = audit;
    }

    public List<GroupResponse> list() {
        return service.list();
    }

    public GroupResponse create(GroupRequest req, Actor actor) {
        GroupResponse g = service.create(req);
        actor.audit(audit, null, FEATURE, "Tạo", g.name(), "Tạo nhóm khách hàng " + g.name() + discount(g));
        return g;
    }

    public GroupResponse update(UUID id, GroupRequest req, Actor actor) {
        GroupResponse g = service.update(id, req);
        actor.audit(audit, null, FEATURE, "Sửa", g.name(), "Cập nhật nhóm khách hàng " + g.name() + discount(g));
        return g;
    }

    /** Xóa nhóm: khách đang thuộc nhóm được bỏ nhóm (không xóa khách). */
    public Map<String, Integer> delete(UUID id, Actor actor) {
        String name = service.find(id).getName();
        int unlinked = service.delete(id);
        actor.audit(audit, null, FEATURE, "Xóa", name,
                "Xóa nhóm khách hàng " + name + (unlinked > 0 ? ", bỏ nhóm của " + unlinked + " khách hàng" : ""));
        return Map.of("unlinkedCustomers", unlinked);
    }

    private static String discount(GroupResponse g) {
        if (g.discountValue().signum() == 0) {
            return "";
        }
        return ", giảm giá " + ("PERCENT".equals(g.discountType())
                ? g.discountValue().stripTrailingZeros().toPlainString() + "%" : Actor.money(g.discountValue()) + "đ");
    }
}
