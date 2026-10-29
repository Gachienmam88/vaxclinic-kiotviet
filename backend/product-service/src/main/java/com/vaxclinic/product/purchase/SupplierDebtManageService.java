package com.vaxclinic.product.purchase;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import com.vaxclinic.product.purchase.SupplierDebtDtos.AdjustmentRequest;
import com.vaxclinic.product.purchase.SupplierDebtDtos.DocDetail;
import com.vaxclinic.product.purchase.SupplierDebtDtos.DocUpdateRequest;
import com.vaxclinic.product.purchase.SupplierDebtDtos.HistoryRow;
import com.vaxclinic.product.purchase.SupplierDebtDtos.LedgerRow;
import com.vaxclinic.product.purchase.SupplierDebtDtos.PaymentRequest;
import com.vaxclinic.product.purchase.SupplierDebtDtos.UnpaidReceipt;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Công nợ NCC cho màn hình: sổ / lịch sử / phiếu nhập chưa trả, lập / sửa / hủy phiếu qua {@link SupplierDebtService}
 * (transaction riêng) rồi đọc lại phiếu và ghi lịch sử thao tác sau khi đã commit.
 */
@Service
public class SupplierDebtManageService {

    private static final Map<String, String> KIND_LABEL = Map.of("PAYMENT", "phiếu chi trả NCC", "DISCOUNT",
            "chiết khấu thanh toán NCC", "ADJUSTMENT", "điều chỉnh công nợ NCC");

    private final SupplierDebtService service;
    private final SupplierDebtQuery query;
    private final AuditLogger audit;

    public SupplierDebtManageService(SupplierDebtService service, SupplierDebtQuery query, AuditLogger audit) {
        this.service = service;
        this.query = query;
        this.audit = audit;
    }

    public List<LedgerRow> ledger(UUID supplierId) {
        return query.ledger(supplierId);
    }

    public List<HistoryRow> history(UUID supplierId) {
        return query.history(supplierId);
    }

    public List<UnpaidReceipt> unpaid(UUID supplierId) {
        return query.unpaid(supplierId);
    }

    public DocDetail doc(UUID docId) {
        return query.doc(docId);
    }

    public DocDetail pay(UUID supplierId, PaymentRequest req, Actor actor) {
        return logged(actor, "Thêm mới", query.doc(service.pay(supplierId, req, actor)), "Tạo");
    }

    public DocDetail discount(UUID supplierId, PaymentRequest req, Actor actor) {
        return logged(actor, "Thêm mới", query.doc(service.discount(supplierId, req, actor)), "Tạo");
    }

    public DocDetail adjust(UUID supplierId, AdjustmentRequest req, Actor actor) {
        return logged(actor, "Thêm mới", query.doc(service.adjust(supplierId, req, actor)), "Tạo");
    }

    public DocDetail update(UUID docId, DocUpdateRequest req, Actor actor) {
        service.update(docId, req);
        return logged(actor, "Sửa", query.doc(docId), "Sửa");
    }

    public DocDetail cancel(UUID docId, Actor actor) {
        service.cancel(docId);
        return logged(actor, "Hủy", query.doc(docId), "Hủy");
    }

    private DocDetail logged(Actor actor, String action, DocDetail d, String verb) {
        audit.record(actor.id(), actor.name(), d.branchId(), "Nhà cung cấp", action,
                d.code(), verb + " " + KIND_LABEL.get(d.kind()) + " " + d.code() + ", NCC " + d.supplierName()
                        + ", giá trị " + String.format("%,.0f", d.amount() == null ? BigDecimal.ZERO : d.amount()));
        return d;
    }
}
