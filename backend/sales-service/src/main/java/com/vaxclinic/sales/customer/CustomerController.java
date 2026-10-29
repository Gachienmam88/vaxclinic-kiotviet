package com.vaxclinic.sales.customer;

import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.customer.CustomerDebtRepository.DebtLine;
import com.vaxclinic.sales.customer.CustomerDtos.CustomerListResponse;
import com.vaxclinic.sales.customer.CustomerDtos.CustomerRequest;
import com.vaxclinic.sales.customer.CustomerDtos.CustomerResponse;
import com.vaxclinic.sales.debt.DebtService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Khách hàng: danh sách / chi tiết / thêm / sửa, sổ nợ, thu nợ, chiết khấu, điều chỉnh nợ. Nghiệp vụ ở {@link CustomerManageService}. */
@RestController
@RequestMapping("/api/customers")
@PreAuthorize("hasAuthority('patient.view') or hasAuthority('sales.perform')")
public class CustomerController {

    private final CustomerManageService service;

    public CustomerController(CustomerManageService service) {
        this.service = service;
    }

    @GetMapping
    public CustomerListResponse list(@RequestParam(required = false) String q,
                                     @RequestParam(required = false) UUID groupId,
                                     @RequestParam(required = false) String groupName,
                                     @RequestParam(required = false) Instant createdFrom,
                                     @RequestParam(required = false) Instant createdTo,
                                     @RequestParam(required = false) UUID createdBy,
                                     @RequestParam(required = false) String customerType,
                                     @RequestParam(required = false) String gender,
                                     @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "15") int size) {
        return service.list(new CustomerListRepository.Filter(q, groupId, groupName, createdFrom, createdTo, createdBy, customerType,
                gender, Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
    }

    /** Tên các nhóm khách hàng (API cũ — danh sách đầy đủ ở /api/customer-groups). */
    @GetMapping("/groups")
    public List<String> groups() {
        return service.groupNames();
    }

    @GetMapping("/{id}")
    public CustomerResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('patient.manage') or hasAuthority('sales.perform')")
    public CustomerResponse create(@Valid @RequestBody CustomerRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.create(req, Actor.of(jwt));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('patient.manage') or hasAuthority('sales.perform')")
    public CustomerResponse update(@PathVariable UUID id, @Valid @RequestBody CustomerRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.update(id, req, Actor.of(jwt));
    }

    /** Tab "Nợ cần thu từ khách" — mới nhất trước. */
    @GetMapping("/{id}/debts")
    public List<DebtLine> debts(@PathVariable UUID id) {
        return service.debts(id);
    }

    @PostMapping("/{id}/payments")
    @PreAuthorize("hasAuthority('sales.perform') or hasAuthority('cashbook.manage')")
    public Map<String, String> pay(@PathVariable UUID id, @Valid @RequestBody DebtService.PaymentRequest req,
                                   @AuthenticationPrincipal Jwt jwt) {
        return service.pay(id, req, Actor.of(jwt));
    }

    @PostMapping("/{id}/discounts")
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public Map<String, String> discount(@PathVariable UUID id, @Valid @RequestBody DebtService.PaymentRequest req,
                                        @AuthenticationPrincipal Jwt jwt) {
        return service.discount(id, req, Actor.of(jwt));
    }

    @PostMapping("/{id}/adjustments")
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public Map<String, String> adjust(@PathVariable UUID id, @Valid @RequestBody DebtService.AdjustRequest req,
                                      @AuthenticationPrincipal Jwt jwt) {
        return service.adjust(id, req, Actor.of(jwt));
    }
}
