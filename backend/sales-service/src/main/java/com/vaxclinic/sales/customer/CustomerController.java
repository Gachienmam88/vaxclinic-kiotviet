package com.vaxclinic.sales.customer;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.customer.CustomerDtos.CodeResponse;
import com.vaxclinic.sales.customer.CustomerDtos.CustomerListResponse;
import com.vaxclinic.sales.customer.CustomerDtos.CustomerRequest;
import com.vaxclinic.sales.customer.CustomerDtos.CustomerResponse;
import com.vaxclinic.sales.customer.CustomerDtos.DebtLine;
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
import java.util.UUID;

@RestController
@RequestMapping("/api/customers")
@PreAuthorize("hasAuthority('patient.view') or hasAuthority('sales.perform')")
public class CustomerController {

    private final CustomerService service;
    private final CustomerListQuery listQuery;
    private final DebtService debt;
    private final AuditLogger audit;

    public CustomerController(CustomerService service, CustomerListQuery listQuery, DebtService debt, AuditLogger audit) {
        this.audit = audit;
        this.service = service;
        this.listQuery = listQuery;
        this.debt = debt;
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
        return listQuery.search(new CustomerListQuery.Filter(q, groupId, groupName, createdFrom, createdTo, createdBy, customerType,
                gender, Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
    }

    /** Tên các nhóm khách hàng (API cũ — danh sách đầy đủ ở /api/customer-groups). */
    @GetMapping("/groups")
    public List<String> groups() {
        return service.groupNames();
    }

    @GetMapping("/{id}")
    public CustomerResponse get(@PathVariable UUID id) {
        return CustomerResponse.of(service.find(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('patient.manage') or hasAuthority('sales.perform')")
    public CustomerResponse create(@Valid @RequestBody CustomerRequest req, @AuthenticationPrincipal Jwt jwt) {
        Customer c = service.create(req, Actor.of(jwt));
        Actor.of(jwt).audit(audit, c.getBranchId(), "Khách hàng", "Tạo", c.getCode(),
                "Tạo khách hàng " + c.getCode() + ", tên " + c.getName() + (c.getPhone() == null ? "" : ", SĐT " + c.getPhone()));
        return CustomerResponse.of(c);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('patient.manage') or hasAuthority('sales.perform')")
    public CustomerResponse update(@PathVariable UUID id, @Valid @RequestBody CustomerRequest req, @AuthenticationPrincipal Jwt jwt) {
        Customer c = service.update(id, req);
        Actor.of(jwt).audit(audit, c.getBranchId(), "Khách hàng", "Sửa", c.getCode(),
                "Cập nhật thông tin khách hàng " + c.getCode() + ", tên " + c.getName());
        return CustomerResponse.of(c);
    }

    /** Tab "Nợ cần thu từ khách" — mới nhất trước. */
    @GetMapping("/{id}/debts")
    public List<DebtLine> debts(@PathVariable UUID id) {
        return listQuery.debtLines(id);
    }

    @PostMapping("/{id}/payments")
    @PreAuthorize("hasAuthority('sales.perform') or hasAuthority('cashbook.manage')")
    public CodeResponse pay(@PathVariable UUID id, @Valid @RequestBody DebtService.PaymentRequest req,
                                   @AuthenticationPrincipal Jwt jwt) {
        String code = debt.pay(id, req, Actor.of(jwt));
        Actor.of(jwt).audit(audit, req.branchId(), "Phiếu thu", "Thu nợ", code,
                "Thu nợ khách " + service.find(id).getName() + ": " + Actor.money(req.amount()) + ", phiếu " + code);
        return new CodeResponse(code);
    }

    @PostMapping("/{id}/discounts")
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public CodeResponse discount(@PathVariable UUID id, @Valid @RequestBody DebtService.PaymentRequest req,
                                        @AuthenticationPrincipal Jwt jwt) {
        String code = debt.discount(id, req, Actor.of(jwt));
        Actor.of(jwt).audit(audit, req.branchId(), "Khách hàng", "Chiết khấu", code,
                "Chiết khấu thanh toán cho khách " + service.find(id).getName() + ": " + Actor.money(req.amount()));
        return new CodeResponse(code);
    }

    @PostMapping("/{id}/adjustments")
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public CodeResponse adjust(@PathVariable UUID id, @Valid @RequestBody DebtService.AdjustRequest req,
                                      @AuthenticationPrincipal Jwt jwt) {
        String code = debt.adjust(id, req);
        Actor.of(jwt).audit(audit, null, "Khách hàng", "Điều chỉnh nợ", code,
                "Điều chỉnh công nợ khách " + service.find(id).getName() + " thành " + Actor.money(req.newDebt()));
        return new CodeResponse(code);
    }
}
