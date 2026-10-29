package com.vaxclinic.product.purchase;

import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import com.vaxclinic.product.purchase.SupplierGroupService.GroupRequest;
import com.vaxclinic.product.purchase.SupplierGroupService.GroupResponse;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Nhóm nhà cung cấp (/api/suppliers/groups): xem cần catalog.view, thêm/sửa/xóa cần inventory.manage.
 * Nghiệp vụ ở {@link SupplierGroupService}.
 */
@RestController
@PreAuthorize("hasAuthority('catalog.view')")
public class SupplierGroupController {

    private final SupplierGroupService service;

    public SupplierGroupController(SupplierGroupService service) {
        this.service = service;
    }

    @GetMapping("/api/suppliers/groups")
    public List<GroupResponse> list() {
        return service.list();
    }

    @PostMapping("/api/suppliers/groups")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public GroupResponse create(@Valid @RequestBody GroupRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.create(req, Actor.of(jwt));
    }

    @PutMapping("/api/suppliers/groups/{id}")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public GroupResponse update(@PathVariable UUID id, @Valid @RequestBody GroupRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.update(id, req, Actor.of(jwt));
    }

    /** Xóa nhóm: NCC trong nhóm chuyển về "Chưa có nhóm". */
    @DeleteMapping("/api/suppliers/groups/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.delete(id, Actor.of(jwt));
    }
}
