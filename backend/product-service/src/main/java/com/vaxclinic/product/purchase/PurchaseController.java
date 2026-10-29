package com.vaxclinic.product.purchase;

import com.vaxclinic.common.security.BranchScope;
import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import com.vaxclinic.product.purchase.PurchaseDtos.ReceiptInfoRequest;
import com.vaxclinic.product.purchase.PurchaseDtos.ReceiptListResponse;
import com.vaxclinic.product.purchase.PurchaseDtos.ReceiptRequest;
import com.vaxclinic.product.purchase.PurchaseDtos.ReceiptResponse;
import com.vaxclinic.product.purchase.PurchaseDtos.ReturnListResponse;
import com.vaxclinic.product.purchase.PurchaseDtos.ReturnRequest;
import com.vaxclinic.product.purchase.PurchaseDtos.ReturnResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * /api/purchase-receipts (nhập hàng) và /api/purchase-returns (trả hàng nhập).
 * ?complete=true khi lưu = bấm "Hoàn thành" (vào/ra kho ngay); false = "Lưu tạm". Nghiệp vụ ở {@link PurchaseManageService}.
 */
@RestController
@PreAuthorize("hasAuthority('inventory.view')")
public class PurchaseController {

    private final PurchaseManageService service;

    public PurchaseController(PurchaseManageService service) {
        this.service = service;
    }

    private static PurchaseListRepository.Filter filter(String q, List<String> statuses, Instant from, Instant to,
                                                   UUID createdBy, UUID personId, String invoiceNo, UUID supplierId,
                                                   UUID branchId, int page, int size, Jwt jwt) {
        List<UUID> branches = BranchScope.check(jwt, branchId);
        return new PurchaseListRepository.Filter(q, statuses, from, to, createdBy, personId, invoiceNo, supplierId, branchId,
                Math.max(page, 0), Math.min(Math.max(size, 1), 100), branches);
    }

    // ===== Phiếu nhập =====

    @GetMapping("/api/purchase-receipts")
    public ReceiptListResponse listReceipts(@RequestParam(required = false) String q,
                                            @RequestParam(required = false) List<String> statuses,
                                            @RequestParam(required = false) Instant from,
                                            @RequestParam(required = false) Instant to,
                                            @RequestParam(required = false) UUID createdBy,
                                            @RequestParam(required = false) UUID receiverId,
                                            @RequestParam(required = false) String inputInvoiceNo,
                                            @RequestParam(required = false) UUID supplierId,
                                            @RequestParam(required = false) UUID branchId,
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "15") int size, @AuthenticationPrincipal Jwt jwt) {
        return service.listReceipts(filter(q, statuses, from, to, createdBy, receiverId, inputInvoiceNo, supplierId,
                branchId, page, size, jwt));
    }

    @GetMapping("/api/purchase-receipts/{id}")
    public ReceiptResponse getReceipt(@PathVariable UUID id) {
        return service.getReceipt(id);
    }

    @PostMapping("/api/purchase-receipts")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public ReceiptResponse createReceipt(@Valid @RequestBody ReceiptRequest req,
                                         @RequestParam(defaultValue = "false") boolean complete,
                                         @AuthenticationPrincipal Jwt jwt) {
        return service.saveReceipt(null, req, complete, Actor.of(jwt));
    }

    @PutMapping("/api/purchase-receipts/{id}")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public ReceiptResponse updateReceipt(@PathVariable UUID id, @Valid @RequestBody ReceiptRequest req,
                                         @RequestParam(defaultValue = "false") boolean complete,
                                         @AuthenticationPrincipal Jwt jwt) {
        return service.saveReceipt(id, req, complete, Actor.of(jwt));
    }

    @PatchMapping("/api/purchase-receipts/{id}/info")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public ReceiptResponse updateReceiptInfo(@PathVariable UUID id, @Valid @RequestBody ReceiptInfoRequest req,
                                             @AuthenticationPrincipal Jwt jwt) {
        return service.updateReceiptInfo(id, req, Actor.of(jwt));
    }

    @PostMapping("/api/purchase-receipts/{id}/cancel")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public ReceiptResponse cancelReceipt(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return service.cancelReceipt(id, Actor.of(jwt));
    }

    // ===== Trả hàng nhập =====

    @GetMapping("/api/purchase-returns")
    public ReturnListResponse listReturns(@RequestParam(required = false) String q,
                                          @RequestParam(required = false) List<String> statuses,
                                          @RequestParam(required = false) Instant from,
                                          @RequestParam(required = false) Instant to,
                                          @RequestParam(required = false) UUID createdBy,
                                          @RequestParam(required = false) UUID returnerId,
                                          @RequestParam(required = false) UUID supplierId,
                                          @RequestParam(required = false) UUID branchId,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "15") int size, @AuthenticationPrincipal Jwt jwt) {
        return service.listReturns(filter(q, statuses, from, to, createdBy, returnerId, null, supplierId, branchId,
                page, size, jwt));
    }

    @GetMapping("/api/purchase-returns/{id}")
    public ReturnResponse getReturn(@PathVariable UUID id) {
        return service.getReturn(id);
    }

    @PostMapping("/api/purchase-returns")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public ReturnResponse createReturn(@Valid @RequestBody ReturnRequest req,
                                       @RequestParam(defaultValue = "false") boolean complete,
                                       @AuthenticationPrincipal Jwt jwt) {
        return service.saveReturn(null, req, complete, Actor.of(jwt));
    }

    @PutMapping("/api/purchase-returns/{id}")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public ReturnResponse updateReturn(@PathVariable UUID id, @Valid @RequestBody ReturnRequest req,
                                       @RequestParam(defaultValue = "false") boolean complete,
                                       @AuthenticationPrincipal Jwt jwt) {
        return service.saveReturn(id, req, complete, Actor.of(jwt));
    }

    @PostMapping("/api/purchase-returns/{id}/cancel")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public ReturnResponse cancelReturn(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return service.cancelReturn(id, Actor.of(jwt));
    }
}
