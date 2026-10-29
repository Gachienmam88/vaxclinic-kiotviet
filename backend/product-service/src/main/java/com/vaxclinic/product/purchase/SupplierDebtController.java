package com.vaxclinic.product.purchase;

import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import com.vaxclinic.product.purchase.SupplierDebtDtos.AdjustmentRequest;
import com.vaxclinic.product.purchase.SupplierDebtDtos.DocDetail;
import com.vaxclinic.product.purchase.SupplierDebtDtos.DocUpdateRequest;
import com.vaxclinic.product.purchase.SupplierDebtDtos.HistoryRow;
import com.vaxclinic.product.purchase.SupplierDebtDtos.LedgerRow;
import com.vaxclinic.product.purchase.SupplierDebtDtos.PaymentRequest;
import com.vaxclinic.product.purchase.SupplierDebtDtos.UnpaidReceipt;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Công nợ NCC: /api/suppliers/{id}/debts|history|unpaid-receipts|payments|discounts|adjustments và
 * /api/suppliers/debt-docs/{docId} (xem / sửa / hủy phiếu). Xem cần catalog.view, ghi cần inventory.manage.
 * Nghiệp vụ ở {@link SupplierDebtManageService}.
 */
@RestController
@PreAuthorize("hasAuthority('catalog.view')")
public class SupplierDebtController {

    private final SupplierDebtManageService service;

    public SupplierDebtController(SupplierDebtManageService service) {
        this.service = service;
    }

    @GetMapping("/api/suppliers/{id}/debts")
    public List<LedgerRow> debts(@PathVariable UUID id) {
        return service.ledger(id);
    }

    @GetMapping("/api/suppliers/{id}/history")
    public List<HistoryRow> history(@PathVariable UUID id) {
        return service.history(id);
    }

    @GetMapping("/api/suppliers/{id}/unpaid-receipts")
    public List<UnpaidReceipt> unpaid(@PathVariable UUID id) {
        return service.unpaid(id);
    }

    @PostMapping("/api/suppliers/{id}/payments")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public DocDetail pay(@PathVariable UUID id, @Valid @RequestBody PaymentRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.pay(id, req, Actor.of(jwt));
    }

    @PostMapping("/api/suppliers/{id}/discounts")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public DocDetail discount(@PathVariable UUID id, @Valid @RequestBody PaymentRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.discount(id, req, Actor.of(jwt));
    }

    @PostMapping("/api/suppliers/{id}/adjustments")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public DocDetail adjust(@PathVariable UUID id, @Valid @RequestBody AdjustmentRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.adjust(id, req, Actor.of(jwt));
    }

    @GetMapping("/api/suppliers/debt-docs/{docId}")
    public DocDetail doc(@PathVariable UUID docId) {
        return service.doc(docId);
    }

    @PatchMapping("/api/suppliers/debt-docs/{docId}")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public DocDetail update(@PathVariable UUID docId, @Valid @RequestBody DocUpdateRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.update(docId, req, Actor.of(jwt));
    }

    @PostMapping("/api/suppliers/debt-docs/{docId}/cancel")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public DocDetail cancel(@PathVariable UUID docId, @AuthenticationPrincipal Jwt jwt) {
        return service.cancel(docId, Actor.of(jwt));
    }
}
