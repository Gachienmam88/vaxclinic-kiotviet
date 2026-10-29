package com.vaxclinic.sales.cashbook;

import com.vaxclinic.sales.cashbook.BankAccountService.BankAccountRequest;
import com.vaxclinic.sales.common.Actor;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * /api/cashbook (Sổ quỹ), /api/bank-accounts, và /internal/cashflows (chỉ service nội bộ).
 * Nghiệp vụ ở {@link CashbookManageService} và {@link BankAccountService}.
 */
@RestController
public class CashbookController {

    private final CashbookManageService cashbook;
    private final BankAccountService banks;

    public CashbookController(CashbookManageService cashbook, BankAccountService banks) {
        this.cashbook = cashbook;
        this.banks = banks;
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
        return cashbook.list(new CashbookQuery.Filter(fund, from, to, voucherTypes, category, statuses, accounting, createdBy,
                collectorId, partnerType, partner, q, branchId, Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
    }

    @GetMapping("/api/cashbook/categories")
    public List<String> categories() {
        return cashbook.categories();
    }

    @GetMapping("/api/cashbook/{id}")
    public Map<String, Object> get(@PathVariable UUID id) {
        return cashbook.get(id);
    }

    @PostMapping("/api/cashbook")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public CashVoucher create(@Valid @RequestBody CashbookService.ManualRequest req, @AuthenticationPrincipal Jwt jwt) {
        return cashbook.create(req, Actor.of(jwt));
    }

    @PostMapping("/api/cashbook/{id}/cancel")
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public void cancel(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        cashbook.cancel(id, Actor.of(jwt));
    }

    /** Mặc định chỉ trả tài khoản ngân hàng (ô chọn tài khoản tạo QR); kind=EWALLET → ví điện tử; kind=ALL → tất cả. */
    @GetMapping("/api/bank-accounts")
    public List<BankAccount> bankAccounts(@RequestParam(defaultValue = "BANK") String kind) {
        return banks.list(kind);
    }

    @PostMapping("/api/bank-accounts")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public BankAccount createBankAccount(@Valid @RequestBody BankAccountRequest req) {
        return banks.create(req);
    }

    @PutMapping("/api/bank-accounts/{id}")
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public BankAccount updateBankAccount(@PathVariable UUID id, @Valid @RequestBody BankAccountRequest req) {
        return banks.update(id, req);
    }

    /** Nội dung mã VietQR cho tài khoản (frontend vẽ thành ảnh QR). */
    @GetMapping("/api/bank-accounts/{id}/vietqr")
    public Map<String, String> vietQr(@PathVariable UUID id, @RequestParam(defaultValue = "0") long amount,
                                      @RequestParam(required = false) String info) {
        return banks.vietQr(id, amount, info);
    }

    @PostMapping("/api/bank-accounts/{id}/deactivate")
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public void deactivateBankAccount(@PathVariable UUID id) {
        banks.deactivate(id);
    }

    @PostMapping("/internal/cashflows")
    @PreAuthorize("hasAuthority('internal')")
    public void inbound(@RequestBody CashbookService.InboundCashflow in) {
        cashbook.inbound(in);
    }
}
