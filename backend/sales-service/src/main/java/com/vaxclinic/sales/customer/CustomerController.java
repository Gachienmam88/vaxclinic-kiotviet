package com.vaxclinic.sales.customer;

import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.customer.CustomerDtos.CustomerListResponse;
import com.vaxclinic.sales.customer.CustomerDtos.CustomerRequest;
import com.vaxclinic.sales.customer.CustomerDtos.CustomerResponse;
import com.vaxclinic.sales.debt.DebtService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/customers")
@PreAuthorize("hasAuthority('patient.view') or hasAuthority('sales.perform')")
public class CustomerController {

    private final CustomerService service;
    private final CustomerListQuery listQuery;
    private final CustomerRepository customers;
    private final DebtService debt;
    private final NamedParameterJdbcTemplate jdbc;

    public CustomerController(CustomerService service, CustomerListQuery listQuery, CustomerRepository customers,
                              DebtService debt, NamedParameterJdbcTemplate jdbc) {
        this.service = service;
        this.listQuery = listQuery;
        this.customers = customers;
        this.debt = debt;
        this.jdbc = jdbc;
    }

    public record DebtLine(UUID id, String docType, String docCode, UUID docId, Instant occurredAt, BigDecimal amount,
                           BigDecimal balanceAfter, String note) {
    }

    @GetMapping
    public CustomerListResponse list(@RequestParam(required = false) String q,
                                     @RequestParam(required = false) String groupName,
                                     @RequestParam(required = false) Instant createdFrom,
                                     @RequestParam(required = false) Instant createdTo,
                                     @RequestParam(required = false) UUID createdBy,
                                     @RequestParam(required = false) String customerType,
                                     @RequestParam(required = false) String gender,
                                     @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "15") int size) {
        return listQuery.search(new CustomerListQuery.Filter(q, groupName, createdFrom, createdTo, createdBy, customerType,
                gender, Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
    }

    @GetMapping("/groups")
    public List<String> groups() {
        return customers.findGroupNames();
    }

    @GetMapping("/{id}")
    public CustomerResponse get(@PathVariable UUID id) {
        return CustomerResponse.of(service.find(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('patient.manage') or hasAuthority('sales.perform')")
    public CustomerResponse create(@Valid @RequestBody CustomerRequest req, @AuthenticationPrincipal Jwt jwt) {
        return CustomerResponse.of(service.create(req, Actor.of(jwt)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('patient.manage') or hasAuthority('sales.perform')")
    public CustomerResponse update(@PathVariable UUID id, @Valid @RequestBody CustomerRequest req) {
        return CustomerResponse.of(service.update(id, req));
    }

    /** Tab "Nợ cần thu từ khách" — mới nhất trước. */
    @GetMapping("/{id}/debts")
    public List<DebtLine> debts(@PathVariable UUID id) {
        return jdbc.query("select * from customer_debt_ledger where customer_id = :id order by occurred_at desc, balance_after limit 200",
                new MapSqlParameterSource("id", id), (rs, n) -> new DebtLine(rs.getObject("id", UUID.class),
                        rs.getString("doc_type"), rs.getString("doc_code"), rs.getObject("doc_id", UUID.class),
                        rs.getTimestamp("occurred_at").toInstant(), rs.getBigDecimal("amount"),
                        rs.getBigDecimal("balance_after"), rs.getString("note")));
    }

    @PostMapping("/{id}/payments")
    @PreAuthorize("hasAuthority('sales.perform') or hasAuthority('cashbook.manage')")
    public Map<String, String> pay(@PathVariable UUID id, @Valid @RequestBody DebtService.PaymentRequest req,
                                   @AuthenticationPrincipal Jwt jwt) {
        return Map.of("code", debt.pay(id, req, Actor.of(jwt)));
    }

    @PostMapping("/{id}/discounts")
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public Map<String, String> discount(@PathVariable UUID id, @Valid @RequestBody DebtService.PaymentRequest req,
                                        @AuthenticationPrincipal Jwt jwt) {
        return Map.of("code", debt.discount(id, req, Actor.of(jwt)));
    }

    @PostMapping("/{id}/adjustments")
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public Map<String, String> adjust(@PathVariable UUID id, @Valid @RequestBody DebtService.AdjustRequest req) {
        return Map.of("code", debt.adjust(id, req));
    }
}
