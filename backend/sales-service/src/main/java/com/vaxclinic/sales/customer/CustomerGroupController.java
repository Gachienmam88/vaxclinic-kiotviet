package com.vaxclinic.sales.customer;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.customer.CustomerGroupService.GroupRequest;
import com.vaxclinic.sales.customer.CustomerGroupService.GroupResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Khách hàng → Nhóm khách hàng (danh sách kèm số khách, thêm / sửa / xóa). */
@RestController
@RequestMapping("/api/customer-groups")
@PreAuthorize("hasAuthority('patient.view') or hasAuthority('sales.perform')")
public class CustomerGroupController {

    private final CustomerGroupService service;
    private final AuditLogger audit;

    public CustomerGroupController(CustomerGroupService service, AuditLogger audit) {
        this.service = service;
        this.audit = audit;
    }

    @GetMapping
    public List<GroupResponse> list() {
        return service.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('patient.manage')")
    public GroupResponse create(@Valid @RequestBody GroupRequest req, @AuthenticationPrincipal Jwt jwt) {
        GroupResponse g = service.create(req);
        Actor.of(jwt).audit(audit, null, "Nhóm khách hàng", "Tạo", g.name(), "Tạo nhóm khách hàng " + g.name() + discount(g));
        return g;
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('patient.manage')")
    public GroupResponse update(@PathVariable UUID id, @Valid @RequestBody GroupRequest req, @AuthenticationPrincipal Jwt jwt) {
        GroupResponse g = service.update(id, req);
        Actor.of(jwt).audit(audit, null, "Nhóm khách hàng", "Sửa", g.name(), "Cập nhật nhóm khách hàng " + g.name() + discount(g));
        return g;
    }

    /** Xóa nhóm: khách đang thuộc nhóm được bỏ nhóm (không xóa khách). */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('patient.manage')")
    public CustomerDtos.GroupDeleteResponse delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        String name = service.find(id).getName();
        int unlinked = service.delete(id);
        Actor.of(jwt).audit(audit, null, "Nhóm khách hàng", "Xóa", name,
                "Xóa nhóm khách hàng " + name + (unlinked > 0 ? ", bỏ nhóm của " + unlinked + " khách hàng" : ""));
        return new CustomerDtos.GroupDeleteResponse(unlinked);
    }

    private static String discount(GroupResponse g) {
        if (g.discountValue().signum() == 0) {
            return "";
        }
        return ", giảm giá " + ("PERCENT".equals(g.discountType())
                ? g.discountValue().stripTrailingZeros().toPlainString() + "%" : Actor.money(g.discountValue()) + "đ");
    }
}
