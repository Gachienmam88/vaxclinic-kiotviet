package com.vaxclinic.sales.customer;

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
import java.util.Map;
import java.util.UUID;

/** Khách hàng → Nhóm khách hàng (danh sách kèm số khách, thêm / sửa / xóa). Nghiệp vụ ở {@link CustomerGroupManageService}. */
@RestController
@RequestMapping("/api/customer-groups")
@PreAuthorize("hasAuthority('patient.view') or hasAuthority('sales.perform')")
public class CustomerGroupController {

    private final CustomerGroupManageService service;

    public CustomerGroupController(CustomerGroupManageService service) {
        this.service = service;
    }

    @GetMapping
    public List<GroupResponse> list() {
        return service.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('patient.manage')")
    public GroupResponse create(@Valid @RequestBody GroupRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.create(req, Actor.of(jwt));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('patient.manage')")
    public GroupResponse update(@PathVariable UUID id, @Valid @RequestBody GroupRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.update(id, req, Actor.of(jwt));
    }

    /** Xóa nhóm: khách đang thuộc nhóm được bỏ nhóm (không xóa khách). */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('patient.manage')")
    public Map<String, Integer> delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return service.delete(id, Actor.of(jwt));
    }
}
