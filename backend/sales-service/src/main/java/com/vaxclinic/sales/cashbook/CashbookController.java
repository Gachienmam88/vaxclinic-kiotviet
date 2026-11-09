package com.vaxclinic.sales.cashbook;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.sales.cashbook.CashbookDtos.BankAccountRequest;
import com.vaxclinic.sales.common.Actor;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** /api/cashbook (Sổ quỹ), /api/bank-accounts, và /internal/cashflows (chỉ service nội bộ). */
@RestController
public class CashbookController {

    private final CashbookQuery query;
    private final CashbookService service;
    private final BankAccountService bankAccounts;
    private final AuditLogger audit;

    public CashbookController(CashbookQuery query, CashbookService service, BankAccountService bankAccounts, AuditLogger audit) {
        this.query = query;
        this.service = service;
        this.bankAccounts = bankAccounts;
        this.audit = audit;
    }

    @GetMapping("/api/cashbook")
    @PreAuthorize("hasAuthority('cashbook.manage') or hasAuthority('report.view')")
    public CashbookQuery.Page list(@RequestParam(defaultValue = "CASH") String fund,
                                   @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
                                   @RequestParam(required = false) List<String> voucherTypes,
                                   @RequestParam(required = false) String category,
                                   @RequestParam(required = false) List<String> statuses,
                                   @RequestParam(required = false) Boolean accounting,
                                   @RequestParam(required = false) UUID createdBy,
                                   @RequestParam(required = false) UUID collectorId,
                                   @RequestParam(required = false) String partnerType,
                                   @RequestParam(required = false) String partner, @RequestParam(required = false) String q,
                                   @RequestParam(required = false) UUID branchId,
                                   @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "15") int size) {
        return query.search(new CashbookQuery.Filter(fund, from, to, voucherTypes, category, statuses, accounting, createdBy,
                collectorId, partnerType, partner, q, branchId, Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
    }

    @GetMapping("/api/cashbook/categories")
    public List<String> categories() {
        return query.categories();
    }

    @GetMapping("/api/cashbook/{id}")
    public Map<String, Object> get(@PathVariable UUID id) {
        return service.detail(id);
    }

    @PostMapping("/api/cashbook")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public CashVoucher create(@Valid @RequestBody CashbookService.ManualRequest req, @AuthenticationPrincipal Jwt jwt) {
        CashVoucher v = service.createManual(req, Actor.of(jwt));
        Actor.of(jwt).audit(audit, v.getBranchId(), voucherFeature(v), "Tạo", v.getCode(), "Tạo phiếu " + v.getCode() + ": "
                + v.getCategory() + ", " + Actor.money(v.getAmount()) + (v.getPartnerName() == null ? "" : ", đối tượng " + v.getPartnerName()));
        return v;
    }

    private static String voucherFeature(CashVoucher v) {
        return "RECEIPT".equals(v.getVoucherType()) ? "Phiếu thu" : "Phiếu chi";
    }

    @PostMapping("/api/cashbook/{id}/cancel")
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public void cancel(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.cancel(id);
        service.find(id).ifPresent(v -> Actor.of(jwt).audit(audit, v.getBranchId(), voucherFeature(v), "Hủy", v.getCode(),
                "Hủy phiếu " + v.getCode() + ": " + v.getCategory() + ", " + Actor.money(v.getAmount())));
    }

    /** Mặc định chỉ trả tài khoản ngân hàng (ô chọn tài khoản tạo QR); kind=EWALLET → ví điện tử; kind=ALL → tất cả. */
    @GetMapping("/api/bank-accounts")
    public List<BankAccount> bankAccounts(@RequestParam(defaultValue = "BANK") String kind) {
        return bankAccounts.list(kind);
    }

    @PostMapping("/api/bank-accounts")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public BankAccount createBankAccount(@Valid @RequestBody BankAccountRequest req) {
        return bankAccounts.create(req);
    }

    @org.springframework.web.bind.annotation.PutMapping("/api/bank-accounts/{id}")
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public BankAccount updateBankAccount(@PathVariable UUID id, @Valid @RequestBody BankAccountRequest req) {
        return bankAccounts.update(id, req);
    }

    /** Nội dung mã VietQR cho tài khoản (frontend vẽ thành ảnh QR). */
    @GetMapping("/api/bank-accounts/{id}/vietqr")
    public Map<String, String> vietQr(@PathVariable UUID id, @RequestParam(defaultValue = "0") long amount,
                                      @RequestParam(required = false) String info) {
        return bankAccounts.vietQr(id, amount, info);
    }

    @PostMapping("/api/bank-accounts/{id}/deactivate")
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public void deactivateBankAccount(@PathVariable UUID id) {
        bankAccounts.deactivate(id);
    }

    @PostMapping("/internal/cashflows")
    @PreAuthorize("hasAuthority('internal')")
    public void inbound(@RequestBody CashbookService.InboundCashflow in) {
        service.inbound(in);
    }
}
