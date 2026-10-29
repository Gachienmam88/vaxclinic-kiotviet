package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.ShipmentInitialStatus;
import com.vaxclinic.sales.invoice.InvoiceDtos.InfoRequest;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceListResponse;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceRequest;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceResponse;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Hóa đơn cho màn hình: danh sách / chi tiết, thanh toán / sửa / hủy ({@link InvoiceService}), sửa thuế ({@link InvoiceWriter}).
 * Trả chi tiết đọc lại sau khi transaction nghiệp vụ commit, rồi ghi lịch sử thao tác.
 */
@Service
public class InvoiceManageService {

    private static final String FEATURE = "Hóa đơn";

    private final InvoiceService service;
    private final InvoiceQuery query;
    private final AuditLogger audit;
    private final ShipmentInitialStatus initialStatus;
    private final TaxReductionPlanner taxPlanner;

    public InvoiceManageService(InvoiceService service, InvoiceQuery query, AuditLogger audit,
                                ShipmentInitialStatus initialStatus, TaxReductionPlanner taxPlanner) {
        this.taxPlanner = taxPlanner;
        this.initialStatus = initialStatus;
        this.service = service;
        this.query = query;
        this.audit = audit;
    }

    public InvoiceListResponse list(InvoiceQuery.Filter filter) {
        return query.search(filter);
    }

    public InvoiceResponse get(UUID id) {
        return query.detail(id);
    }

    /** Gửi lại cùng id (offline / retry) trả về hóa đơn đã tạo, không tạo trùng. Lịch sử "Tạo" ghi trong InvoiceService. */
    public InvoiceResponse create(InvoiceRequest req, Actor actor) {
        UUID id = service.create(req, actor);
        initialStatus.apply(id, req.delivery(), actor); // "Trạng thái giao hàng" chọn ở màn bán hàng (sau khi hóa đơn đã lưu)
        return query.detail(id);
    }

    public InvoiceResponse update(UUID id, int revision, InvoiceRequest req, Actor actor) {
        service.update(id, revision, req, actor);
        initialStatus.apply(id, req.delivery(), actor);
        InvoiceResponse r = query.detail(id);
        actor.audit(audit, r.branchId(), FEATURE, "Sửa", r.code(), "Cập nhật hóa đơn " + r.code() + ", khách "
                + r.customerName() + ", tổng " + Actor.money(r.total()) + ", đã trả " + Actor.money(r.paid()));
        return r;
    }

    public InvoiceResponse updateTaxCodes(UUID id, List<InvoiceDtos.TaxCodeChange> changes, Actor actor) {
        service.updateTaxCodes(id, changes, actor);
        InvoiceResponse r = query.detail(id);
        actor.audit(audit, r.branchId(), FEATURE, "Sửa thuế", r.code(),
                "Sửa tỷ lệ thuế " + changes.size() + " dòng hàng của hóa đơn " + r.code());
        return r;
    }

    /** Xem trước giảm thuế (server tra hàng + thiết lập thuế như khi lưu). */
    public InvoiceDtos.TaxReductionPreview previewTaxReduction(InvoiceDtos.TaxReductionPreviewRequest req) {
        var totals = InvoiceMath.totals(req.lines(), req.discount(), taxPlanner.plan(req.lines(), true, req.soldAt()));
        return new InvoiceDtos.TaxReductionPreview(totals.taxReduction(), totals.taxMethod(), totals.reducedLines());
    }

    public List<InvoiceDtos.RecentPrice> recentPrices(UUID productId, UUID customerId) {
        return query.recentPrices(productId, customerId);
    }

    public InvoiceResponse updateInfo(UUID id, InfoRequest req, Actor actor) {
        service.updateInfo(id, req, actor);
        InvoiceResponse r = query.detail(id);
        actor.audit(audit, r.branchId(), FEATURE, "Sửa", r.code(), "Cập nhật thông tin hóa đơn " + r.code()
                + ": người bán " + r.sellerName() + ", thời gian " + r.soldAt() + ", kênh bán " + r.salesChannelName() + (r.note() == null ? "" : ", ghi chú " + r.note()));
        return r;
    }

    public InvoiceResponse cancel(UUID id, Actor actor) {
        return cancel(id, actor, false);
    }

    public InvoiceResponse cancel(UUID id, Actor actor, boolean cancelOrderPayments) {
        service.cancel(id, actor, cancelOrderPayments);
        InvoiceResponse r = query.detail(id);
        actor.audit(audit, r.branchId(), FEATURE, "Hủy", r.code(), "Hủy hóa đơn " + r.code() + ", khách "
                + r.customerName() + ", tổng " + Actor.money(r.total()));
        return r;
    }
}
