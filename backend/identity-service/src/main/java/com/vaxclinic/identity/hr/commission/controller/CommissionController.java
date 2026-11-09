package com.vaxclinic.identity.hr.commission.controller;

import com.vaxclinic.identity.hr.commission.service.CommissionService;
import com.vaxclinic.identity.hr.dto.HrActor;
import com.vaxclinic.identity.hr.commission.dto.CommissionDtos.EmployeesRequest;
import com.vaxclinic.identity.hr.commission.dto.CommissionDtos.Rule;
import com.vaxclinic.identity.hr.commission.dto.CommissionDtos.RulesRequest;
import com.vaxclinic.identity.hr.commission.dto.CommissionDtos.Table;
import com.vaxclinic.identity.hr.commission.dto.CommissionDtos.TableRequest;
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

/**
 * Bảng hoa hồng: mỗi bảng có mức hoa hồng theo mặt hàng (% doanh thu hoặc số tiền / 1 đơn vị bán) và danh sách nhân viên áp dụng.
 * Áp theo nhóm hàng: màn hình gửi mức cho toàn bộ mặt hàng của nhóm.
 */
@RestController
@RequestMapping("/api/hr/commission-tables")
@PreAuthorize("hasAuthority('hr.manage')")
public class CommissionController {

    private final CommissionService service;

    public CommissionController(CommissionService service) {
        this.service = service;
    }

    @GetMapping
    public List<Table> list() {
        return service.list();
    }

    @GetMapping("/rules")
    public List<Rule> rules() {
        return service.rules();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Table create(@Valid @RequestBody TableRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.create(req, HrActor.of(jwt));
    }

    @PutMapping("/{id}")
    public Table update(@PathVariable UUID id, @Valid @RequestBody TableRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.update(id, req, HrActor.of(jwt));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.delete(id, HrActor.of(jwt));
    }

    @PutMapping("/{id}/rules")
    public Table saveRules(@PathVariable UUID id, @Valid @RequestBody RulesRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.saveRules(id, req, HrActor.of(jwt));
    }

    @GetMapping("/{id}/employees")
    public List<UUID> employees(@PathVariable UUID id) {
        return service.employees(id);
    }

    /** Đặt danh sách nhân viên áp dụng bảng (nhân viên khác đang dùng bảng này sẽ bỏ áp dụng). */
    @PutMapping("/{id}/employees")
    public Table saveEmployees(@PathVariable UUID id, @Valid @RequestBody EmployeesRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.saveEmployees(id, req, HrActor.of(jwt));
    }
}
