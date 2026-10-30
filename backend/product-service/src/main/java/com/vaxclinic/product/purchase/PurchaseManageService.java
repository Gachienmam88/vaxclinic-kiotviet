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
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Phiếu nhập / trả hàng nhập cho màn hình: gọi {@link PurchaseReceiptService} / {@link PurchaseReturnService}
 * (transaction riêng) rồi đọc lại phiếu và ghi lịch sử thao tác sau khi đã commit.
 */
@Service
public class PurchaseManageService {

    private final PurchaseReceiptService receiptService;
    private final PurchaseReceiptAdjustService adjustService;
    private final PurchaseReturnService returnService;
    private final PurchaseListRepository listQuery;
    private final PurchaseDetailMapper mapper;
    private final AuditLogger audit;

    public PurchaseManageService(PurchaseReceiptService receiptService, PurchaseReceiptAdjustService adjustService,
                                 PurchaseReturnService returnService, PurchaseListRepository listQuery,
                                 PurchaseDetailMapper mapper, AuditLogger audit) {
        this.receiptService = receiptService;
        this.adjustService = adjustService;
        this.returnService = returnService;
        this.listQuery = listQuery;
        this.mapper = mapper;
        this.audit = audit;
    }

    // ===== Phiếu nhập =====

    public ReceiptListResponse listReceipts(PurchaseListRepository.Filter filter) {
        return listQuery.receipts(filter);
    }

    public ReceiptResponse getReceipt(UUID id) {
        receiptService.find(id);
        return mapper.receipt(id);
    }

    /** id null = tạo mới. */
    public ReceiptResponse saveReceipt(UUID id, ReceiptRequest req, boolean complete, Actor actor) {
        return logReceipt(actor, mapper.receipt(receiptService.save(id, req, complete, actor)), complete);
    }

    /** Sửa phiếu đã nhập (Mở phiếu → Lưu): ghi lại kho / giá vốn / công nợ NCC. */
    public ReceiptResponse adjustReceipt(UUID id, ReceiptRequest req, Actor actor) {
        ReceiptResponse before = mapper.receipt(receiptService.find(id).getId());
        ReceiptResponse r = mapper.receipt(adjustService.adjust(id, req, actor));
        log(actor, r.branchId(), "Nhập hàng", "Sửa", r.code(), "Sửa phiếu đã nhập " + r.code() + ", NCC "
                + (r.supplierName() == null ? "(không có)" : r.supplierName()) + ", cần trả NCC " + money(before.total())
                + " → " + money(r.total()));
        return r;
    }

    public java.util.List<PurchaseDtos.ReturnableLine> returnable(UUID receiptId) {
        return returnService.returnable(receiptId);
    }

    public ReceiptResponse updateReceiptInfo(UUID id, ReceiptInfoRequest req, Actor actor) {
        receiptService.updateInfo(id, req);
        ReceiptResponse r = mapper.receipt(id);
        log(actor, r.branchId(), "Nhập hàng", "Sửa", r.code(), "Cập nhật thông tin phiếu nhập " + r.code()
                + (r.inputInvoiceNo() == null ? "" : ", số HĐ " + r.inputInvoiceNo()));
        return r;
    }

    public ReceiptResponse cancelReceipt(UUID id, Actor actor) {
        receiptService.cancel(id, actor);
        ReceiptResponse r = mapper.receipt(id);
        log(actor, r.branchId(), "Nhập hàng", "Hủy", r.code(), "Hủy phiếu nhập " + r.code() + ", tổng " + money(r.total()));
        return r;
    }

    // ===== Trả hàng nhập =====

    public ReturnListResponse listReturns(PurchaseListRepository.Filter filter) {
        return listQuery.returns(filter);
    }

    public ReturnResponse getReturn(UUID id) {
        returnService.find(id);
        return mapper.purchaseReturn(id);
    }

    /** id null = tạo mới. */
    public ReturnResponse saveReturn(UUID id, ReturnRequest req, boolean complete, Actor actor) {
        return logReturn(actor, mapper.purchaseReturn(returnService.save(id, req, complete, actor)), complete);
    }

    public ReturnResponse cancelReturn(UUID id, Actor actor) {
        returnService.cancel(id, actor);
        ReturnResponse r = mapper.purchaseReturn(id);
        log(actor, r.branchId(), "Trả hàng nhập", "Hủy", r.code(), "Hủy phiếu trả hàng nhập " + r.code());
        return r;
    }

    private ReceiptResponse logReceipt(Actor actor, ReceiptResponse r, boolean complete) {
        log(actor, r.branchId(), "Nhập hàng", complete ? "Nhập kho" : "Lưu tạm", r.code(), (complete ? "Nhập hàng " : "Lưu tạm phiếu nhập ")
                + r.code() + ", NCC " + (r.supplierName() == null ? "(không có)" : r.supplierName()) + ", cần trả NCC " + money(r.total()));
        return r;
    }

    private ReturnResponse logReturn(Actor actor, ReturnResponse r, boolean complete) {
        log(actor, r.branchId(), "Trả hàng nhập", complete ? "Trả hàng" : "Lưu tạm", r.code(), (complete ? "Trả hàng nhập " : "Lưu tạm phiếu trả hàng nhập ")
                + r.code() + ", NCC " + (r.supplierName() == null ? "(không có)" : r.supplierName()) + ", tổng " + money(r.total()));
        return r;
    }

    /** Ghi lịch sử thao tác (Thiết lập → Lịch sử thao tác). */
    private void log(Actor actor, UUID branchId, String feature, String action, String code, String detail) {
        audit.record(actor.id(), actor.name(), branchId, feature, action, code, detail);
    }

    private static String money(BigDecimal v) {
        return v == null ? "0" : String.format("%,.0f", v);
    }
}
