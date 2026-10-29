package com.vaxclinic.sales.delivery;

import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.GroupRequest;
import com.vaxclinic.sales.delivery.DeliveryPartnerDtos.GroupRow;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Nhóm đối tác giao hàng (ô "Nhóm đối tác" ở form Thêm / Sửa đối tác). Nghiệp vụ ở {@link DeliveryPartnerGroupService}. */
@RestController
@RequestMapping("/api/delivery-partners/groups") // dưới /api/delivery-partners: gateway đã định tuyến sẵn
@PreAuthorize("hasAuthority('sales.perform') or hasAuthority('report.view')")
public class DeliveryPartnerGroupController {

    private final DeliveryPartnerGroupService service;

    public DeliveryPartnerGroupController(DeliveryPartnerGroupService service) {
        this.service = service;
    }

    @GetMapping
    public List<GroupRow> list() {
        return service.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('sales.perform')")
    public GroupRow create(@Valid @RequestBody GroupRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.create(req, Actor.of(jwt));
    }
}
