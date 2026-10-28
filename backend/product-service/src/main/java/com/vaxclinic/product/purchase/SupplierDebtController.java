package com.vaxclinic.product.purchase;

import com.vaxclinic.common.audit.AuditLogger;
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

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Công nợ NCC: /api/suppliers/{id}/debts|history|unpaid-receipts|payments|discounts|adjustments và
 * /api/suppliers/debt-docs/{docId} (xem / sửa / hủy phiếu). Xem cần catalog.view, ghi cần inventory.manage.
 */
@RestController
@PreAuthorize("hasAuthority('catalog.view')")
public class SupplierDebtController {

    private static final Map<String, String> KIND_LABEL = Map.of("PAYMENT", "Phiếu chi trả NCC", "DISCOUNT",
            "Chiết khấu thanh toán NCC", "ADJUSTMENT", "Điều chỉnh công nợ NCC");

    private final SupplierDebtService service;
    private final SupplierDebtQuery query;
    private final AuditLogger audit;

    public SupplierDebtController(SupplierDebtService service, SupplierDebtQuery query, AuditLogger audit) {
        this.service = service;
        this.query = query;
        this.audit = audit;
    }

    @GetMapping("/api/suppliers/{id}/debts")
    public List<LedgerRow> debts(@PathVariable UUID id) {
        return query.ledger(id);
    }

    @GetMapping("/api/suppliers/{id}/history")
    public List<HistoryRow> history(@PathVariable UUID id) {
        return query.history(id);
    }

    @GetMapping("/api/suppliers/{id}/unpaid-receipts")
    public List<UnpaidReceipt> unpaid(@PathVariable UUID id) {
        return query.unpaid(id);
    }

    @PostMapping("/api/suppliers/{id}/payments")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public DocDetail pay(@PathVariable UUID id, @Valid @RequestBody PaymentRequest req, @AuthenticationPrincipal Jwt jwt) {
        return logged(jwt, "Thêm mới", query.doc(service.pay(id, req, SupplierController.actor(jwt))), "Tạo");
    }

    @PostMapping("/api/suppliers/{id}/discounts")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public DocDetail discount(@PathVariable UUID id, @Valid @RequestBody PaymentRequest req, @AuthenticationPrincipal Jwt jwt) {
        return logged(jwt, "Thêm mới", query.doc(service.discount(id, req, SupplierController.actor(jwt))), "Tạo");
    }

    @PostMapping("/api/suppliers/{id}/adjustments")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public DocDetail adjust(@PathVariable UUID id, @Valid @RequestBody AdjustmentRequest req, @AuthenticationPrincipal Jwt jwt) {
        return logged(jwt, "Thêm mới", query.doc(service.adjust(id, req, SupplierController.actor(jwt))), "Tạo");
    }

    @GetMapping("/api/suppliers/debt-docs/{docId}")
    public DocDetail doc(@PathVariable UUID docId) {
        return query.doc(docId);
    }

    @PatchMapping("/api/suppliers/debt-docs/{docId}")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public DocDetail update(@PathVariable UUID docId, @Valid @RequestBody DocUpdateRequest req, @AuthenticationPrincipal Jwt jwt) {
        service.update(docId, req);
        return logged(jwt, "Sửa", query.doc(docId), "Sửa");
    }

    @PostMapping("/api/suppliers/debt-docs/{docId}/cancel")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public DocDetail cancel(@PathVariable UUID docId, @AuthenticationPrincipal Jwt jwt) {
        service.cancel(docId);
        return logged(jwt, "Hủy", query.doc(docId), "Hủy");
    }

    private DocDetail logged(Jwt jwt, String action, DocDetail d, String verb) {
        audit.record(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"), d.branchId(), "Nhà cung cấp", action,
                d.code(), verb + " " + KIND_LABEL.get(d.kind()).toLowerCase() + " " + d.code() + ", NCC " + d.supplierName()
                        + ", giá trị " + String.format("%,.0f", d.amount() == null ? BigDecimal.ZERO : d.amount()));
        return d;
    }
}
