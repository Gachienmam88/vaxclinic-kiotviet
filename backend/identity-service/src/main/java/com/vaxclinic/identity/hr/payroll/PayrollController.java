package com.vaxclinic.identity.hr.payroll;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.identity.hr.HrActor;
import com.vaxclinic.identity.hr.settings.HrSettingsService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Bảng lương: danh sách, tạo, chi tiết, tính lại, chốt, hủy, thưởng, thanh toán. */
@RestController
@RequestMapping("/api/hr/payrolls")
@PreAuthorize("hasAuthority('hr.manage')")
public class PayrollController {

    /** Trống kỳ → kỳ lương hiện tại theo "Ngày bắt đầu kỳ lương". */
    public record CreateRequest(@Size(max = 150) String name, LocalDate periodStart, LocalDate periodEnd, UUID branchId) {
    }

    public record BonusRequest(@NotNull @DecimalMin("0") BigDecimal bonus) {
    }

    public record PayRequest(@NotEmpty List<PayrollPaymentService.PayItem> items, @Pattern(regexp = "CASH|BANK") String method,
                             Instant paidAt) {
    }

    private final PayrollQuery query;
    private final PayrollService service;
    private final PayrollPaymentService payments;
    private final HrSettingsService settings;
    private final AuditLogger audit;

    public PayrollController(PayrollQuery query, PayrollService service, PayrollPaymentService payments, HrSettingsService settings,
                             AuditLogger audit) {
        this.query = query;
        this.service = service;
        this.payments = payments;
        this.settings = settings;
        this.audit = audit;
    }

    @GetMapping
    public PayrollQuery.Page list(@RequestParam(required = false) List<String> statuses, @RequestParam(defaultValue = "") String q,
                                  @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "15") int size) {
        return query.search(statuses, q, page, size);
    }

    @GetMapping("/{id}")
    public PayrollQuery.Detail get(@PathVariable UUID id) {
        return query.detail(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PayrollQuery.Detail create(@Valid @RequestBody CreateRequest req, @AuthenticationPrincipal Jwt jwt) {
        var period = PayRates.periodOf(LocalDate.now(ShopSettings.ZONE), settings.payroll().startDay());
        LocalDate start = req.periodStart() == null ? period.start() : req.periodStart();
        LocalDate end = req.periodEnd() == null ? (req.periodStart() == null ? period.end() : start.plusMonths(1).minusDays(1)) : req.periodEnd();
        HrActor actor = HrActor.of(jwt);
        UUID id = service.create(req.name(), start, end, req.branchId(), actor);
        var d = query.detail(id);
        actor.audit(audit, "Bảng lương", "Tạo", d.payroll().code(), "Tạo " + d.payroll().name() + " (" + start + " - " + end + "), tổng lương "
                + HrActor.money(d.payroll().total()));
        return d;
    }

    @PostMapping("/{id}/recalculate")
    public PayrollQuery.Detail recalculate(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.recalculate(id);
        return logged(jwt, id, "Tính lại", "Tính lại bảng lương");
    }

    @PostMapping("/{id}/lock")
    public PayrollQuery.Detail lock(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.lock(id);
        return logged(jwt, id, "Chốt lương", "Chốt bảng lương");
    }

    @PostMapping("/{id}/cancel")
    public PayrollQuery.Detail cancel(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.cancel(id);
        return logged(jwt, id, "Hủy", "Hủy bảng lương");
    }

    @PutMapping("/{id}/payslips/{slipId}")
    public PayrollQuery.Detail bonus(@PathVariable UUID id, @PathVariable UUID slipId, @Valid @RequestBody BonusRequest req,
                                     @AuthenticationPrincipal Jwt jwt) {
        service.setBonus(id, slipId, req.bonus());
        return logged(jwt, id, "Sửa", "Cập nhật thưởng " + HrActor.money(req.bonus()));
    }

    @PostMapping("/{id}/payments")
    public PayrollQuery.Detail pay(@PathVariable UUID id, @Valid @RequestBody PayRequest req, @AuthenticationPrincipal Jwt jwt) {
        HrActor actor = HrActor.of(jwt);
        List<String> codes = payments.pay(id, req.items(), req.method() == null ? "CASH" : req.method(),
                req.paidAt() == null ? Instant.now() : req.paidAt(), actor);
        return logged(jwt, id, "Thanh toán", "Thanh toán lương, phiếu " + String.join(", ", codes));
    }

    @PostMapping("/payments/{paymentId}/cancel")
    public Map<String, String> cancelPayment(@PathVariable UUID paymentId, @AuthenticationPrincipal Jwt jwt) {
        String code = payments.cancel(paymentId);
        HrActor.of(jwt).audit(audit, "Bảng lương", "Hủy thanh toán", code, "Hủy phiếu thanh toán lương " + code);
        return Map.of("code", code);
    }

    private PayrollQuery.Detail logged(Jwt jwt, UUID id, String action, String detail) {
        var d = query.detail(id);
        HrActor.of(jwt).audit(audit, "Bảng lương", action, d.payroll().code(), detail + " " + d.payroll().code() + ", tổng lương "
                + HrActor.money(d.payroll().total()));
        return d;
    }
}
