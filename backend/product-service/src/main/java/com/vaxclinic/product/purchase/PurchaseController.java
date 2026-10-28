package com.vaxclinic.product.purchase;

import com.vaxclinic.common.audit.AuditLogger;
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
 * ?complete=true khi lưu = bấm "Hoàn thành" (vào/ra kho ngay); false = "Lưu tạm".
 */
@RestController
@PreAuthorize("hasAuthority('inventory.view')")
public class PurchaseController {

    private final PurchaseReceiptService receiptService;
    private final PurchaseReturnService returnService;
    private final PurchaseListQuery listQuery;
    private final PurchaseDetailMapper mapper;
    private final AuditLogger audit;

    public PurchaseController(PurchaseReceiptService receiptService, PurchaseReturnService returnService,
                              PurchaseListQuery listQuery, PurchaseDetailMapper mapper, AuditLogger audit) {
        this.receiptService = receiptService;
        this.returnService = returnService;
        this.listQuery = listQuery;
        this.mapper = mapper;
        this.audit = audit;
    }

    /** Ghi lịch sử thao tác (Thiết lập → Lịch sử thao tác). */
    private void log(Jwt jwt, UUID branchId, String feature, String action, String code, String detail) {
        audit.record(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"), branchId, feature, action, code, detail);
    }

    private static String money(java.math.BigDecimal v) {
        return v == null ? "0" : String.format("%,.0f", v);
    }

    private ReceiptResponse logReceipt(Jwt jwt, ReceiptResponse r, boolean complete) {
        log(jwt, r.branchId(), "Nhập hàng", complete ? "Nhập kho" : "Lưu tạm", r.code(), (complete ? "Nhập hàng " : "Lưu tạm phiếu nhập ")
                + r.code() + ", NCC " + (r.supplierName() == null ? "(không có)" : r.supplierName()) + ", cần trả NCC " + money(r.total()));
        return r;
    }

    private ReturnResponse logReturn(Jwt jwt, ReturnResponse r, boolean complete) {
        log(jwt, r.branchId(), "Trả hàng nhập", complete ? "Trả hàng" : "Lưu tạm", r.code(), (complete ? "Trả hàng nhập " : "Lưu tạm phiếu trả hàng nhập ")
                + r.code() + ", NCC " + (r.supplierName() == null ? "(không có)" : r.supplierName()) + ", tổng " + money(r.total()));
        return r;
    }

    private static Actor actor(Jwt jwt) {
        List<String> branches = jwt.getClaimAsStringList("branches");
        return new Actor(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"),
                branches == null ? List.of() : branches);
    }

    private static PurchaseListQuery.Filter filter(String q, List<String> statuses, Instant from, Instant to,
                                                   UUID createdBy, UUID personId, String invoiceNo, UUID supplierId,
                                                   UUID branchId, int page, int size) {
        return new PurchaseListQuery.Filter(q, statuses, from, to, createdBy, personId, invoiceNo, supplierId, branchId,
                Math.max(page, 0), Math.min(Math.max(size, 1), 100));
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
                                            @RequestParam(defaultValue = "15") int size) {
        return listQuery.receipts(filter(q, statuses, from, to, createdBy, receiverId, inputInvoiceNo, supplierId,
                branchId, page, size));
    }

    @GetMapping("/api/purchase-receipts/{id}")
    public ReceiptResponse getReceipt(@PathVariable UUID id) {
        receiptService.find(id);
        return mapper.receipt(id);
    }

    @PostMapping("/api/purchase-receipts")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public ReceiptResponse createReceipt(@Valid @RequestBody ReceiptRequest req,
                                         @RequestParam(defaultValue = "false") boolean complete,
                                         @AuthenticationPrincipal Jwt jwt) {
        return logReceipt(jwt, mapper.receipt(receiptService.save(null, req, complete, actor(jwt))), complete);
    }

    @PutMapping("/api/purchase-receipts/{id}")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public ReceiptResponse updateReceipt(@PathVariable UUID id, @Valid @RequestBody ReceiptRequest req,
                                         @RequestParam(defaultValue = "false") boolean complete,
                                         @AuthenticationPrincipal Jwt jwt) {
        return logReceipt(jwt, mapper.receipt(receiptService.save(id, req, complete, actor(jwt))), complete);
    }

    @PatchMapping("/api/purchase-receipts/{id}/info")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public ReceiptResponse updateReceiptInfo(@PathVariable UUID id, @Valid @RequestBody ReceiptInfoRequest req,
                                             @AuthenticationPrincipal Jwt jwt) {
        receiptService.updateInfo(id, req);
        ReceiptResponse r = mapper.receipt(id);
        log(jwt, r.branchId(), "Nhập hàng", "Sửa", r.code(), "Cập nhật thông tin phiếu nhập " + r.code()
                + (r.inputInvoiceNo() == null ? "" : ", số HĐ " + r.inputInvoiceNo()));
        return r;
    }

    @PostMapping("/api/purchase-receipts/{id}/cancel")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public ReceiptResponse cancelReceipt(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        receiptService.cancel(id, actor(jwt));
        ReceiptResponse r = mapper.receipt(id);
        log(jwt, r.branchId(), "Nhập hàng", "Hủy", r.code(), "Hủy phiếu nhập " + r.code() + ", tổng " + money(r.total()));
        return r;
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
                                          @RequestParam(defaultValue = "15") int size) {
        return listQuery.returns(filter(q, statuses, from, to, createdBy, returnerId, null, supplierId, branchId,
                page, size));
    }

    @GetMapping("/api/purchase-returns/{id}")
    public ReturnResponse getReturn(@PathVariable UUID id) {
        returnService.find(id);
        return mapper.purchaseReturn(id);
    }

    @PostMapping("/api/purchase-returns")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory.manage')")
    public ReturnResponse createReturn(@Valid @RequestBody ReturnRequest req,
                                       @RequestParam(defaultValue = "false") boolean complete,
                                       @AuthenticationPrincipal Jwt jwt) {
        return logReturn(jwt, mapper.purchaseReturn(returnService.save(null, req, complete, actor(jwt))), complete);
    }

    @PutMapping("/api/purchase-returns/{id}")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public ReturnResponse updateReturn(@PathVariable UUID id, @Valid @RequestBody ReturnRequest req,
                                       @RequestParam(defaultValue = "false") boolean complete,
                                       @AuthenticationPrincipal Jwt jwt) {
        return logReturn(jwt, mapper.purchaseReturn(returnService.save(id, req, complete, actor(jwt))), complete);
    }

    @PostMapping("/api/purchase-returns/{id}/cancel")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public ReturnResponse cancelReturn(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        returnService.cancel(id, actor(jwt));
        ReturnResponse r = mapper.purchaseReturn(id);
        log(jwt, r.branchId(), "Trả hàng nhập", "Hủy", r.code(), "Hủy phiếu trả hàng nhập " + r.code());
        return r;
    }
}
