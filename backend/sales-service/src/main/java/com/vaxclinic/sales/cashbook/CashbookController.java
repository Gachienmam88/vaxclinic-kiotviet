package com.vaxclinic.sales.cashbook;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** /api/cashbook (Sổ quỹ), /api/bank-accounts, và /internal/cashflows (chỉ service nội bộ). */
@RestController
public class CashbookController {

    private final CashbookQuery query;
    private final CashbookService service;
    private final CashVoucherRepository vouchers;
    private final BankAccountRepository banks;
    private final NamedParameterJdbcTemplate jdbc;

    public CashbookController(CashbookQuery query, CashbookService service, CashVoucherRepository vouchers,
                              BankAccountRepository banks, NamedParameterJdbcTemplate jdbc) {
        this.query = query;
        this.service = service;
        this.vouchers = vouchers;
        this.banks = banks;
        this.jdbc = jdbc;
    }

    public record Allocated(UUID invoiceId, String invoiceCode, Instant soldAt, BigDecimal invoiceTotal, BigDecimal amount) {
    }

    public record BankAccountRequest(@NotBlank String bankName, String bankBin, @NotBlank String accountNo,
                                     @NotBlank String accountName) {
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
    @Transactional(readOnly = true)
    public Map<String, Object> get(@PathVariable UUID id) {
        CashVoucher v = vouchers.findById(id)
                .orElseThrow(() -> BusinessException.notFound("VOUCHER_NOT_FOUND", "Không tìm thấy phiếu"));
        var allocations = jdbc.query("""
                select i.id, i.code, i.sold_at, i.total, a.amount from voucher_allocations a
                join invoices i on i.id = a.invoice_id where a.voucher_id = :id order by i.sold_at""",
                new MapSqlParameterSource("id", id), (rs, n) -> new Allocated(rs.getObject("id", UUID.class),
                        rs.getString("code"), rs.getTimestamp("sold_at").toInstant(), rs.getBigDecimal("total"),
                        rs.getBigDecimal("amount")));
        return Map.of("voucher", v, "allocations", allocations);
    }

    @PostMapping("/api/cashbook")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public CashVoucher create(@Valid @RequestBody CashbookService.ManualRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.createManual(req, Actor.of(jwt));
    }

    @PostMapping("/api/cashbook/{id}/cancel")
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public void cancel(@PathVariable UUID id) {
        service.cancel(id);
    }

    @GetMapping("/api/bank-accounts")
    public List<BankAccount> bankAccounts() {
        return banks.findByActiveTrueOrderByBankNameAsc();
    }

    @PostMapping("/api/bank-accounts")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public BankAccount createBankAccount(@Valid @RequestBody BankAccountRequest req) {
        var b = new BankAccount();
        b.setId(UUID.randomUUID());
        b.setBankName(req.bankName().trim());
        b.setBankBin(Actor.blankToNull(req.bankBin()));
        b.setAccountNo(req.accountNo().trim());
        b.setAccountName(req.accountName().trim().toUpperCase());
        return banks.save(b);
    }

    /** Nội dung mã VietQR cho tài khoản (frontend vẽ thành ảnh QR). */
    @GetMapping("/api/bank-accounts/{id}/vietqr")
    public Map<String, String> vietQr(@PathVariable UUID id, @RequestParam(defaultValue = "0") long amount,
                                      @RequestParam(required = false) String info) {
        BankAccount b = banks.findById(id)
                .orElseThrow(() -> BusinessException.notFound("BANK_ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản"));
        if (b.getBankBin() == null || b.getBankBin().isBlank()) {
            throw BusinessException.badRequest("BANK_BIN_MISSING", "Tài khoản chưa có mã ngân hàng (BIN) để tạo QR");
        }
        return Map.of("payload", VietQrPayload.build(b.getBankBin(), b.getAccountNo(), Math.max(amount, 0), info),
                "bankName", b.getBankName(), "accountNo", b.getAccountNo(), "accountName", b.getAccountName());
    }

    @PostMapping("/api/bank-accounts/{id}/deactivate")
    @PreAuthorize("hasAuthority('cashbook.manage')")
    public void deactivateBankAccount(@PathVariable UUID id) {
        banks.findById(id).ifPresent(b -> {
            b.setActive(false);
            banks.save(b);
        });
    }

    @PostMapping("/internal/cashflows")
    @PreAuthorize("hasAuthority('internal')")
    public void inbound(@RequestBody CashbookService.InboundCashflow in) {
        service.inbound(in);
    }
}
