package com.vaxclinic.sales.order;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceRequest;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceResponse;
import com.vaxclinic.sales.invoice.InvoiceQuery;
import com.vaxclinic.sales.invoice.InvoiceService;
import com.vaxclinic.sales.order.OrderDtos.OrderListResponse;
import com.vaxclinic.sales.order.OrderDtos.OrderRequest;
import com.vaxclinic.sales.order.OrderDtos.OrderResponse;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Đặt hàng cho màn hình: danh sách / chi tiết, tạo / sửa / xác nhận / hủy ({@link OrderService}), tạo hóa đơn từ đơn.
 * Trả chi tiết đọc lại sau khi transaction nghiệp vụ commit, rồi ghi lịch sử thao tác.
 */
@Service
public class OrderManageService {

    private final OrderService service;
    private final OrderQuery query;
    private final InvoiceService invoices;
    private final InvoiceQuery invoiceQuery;
    private final AuditLogger audit;

    public OrderManageService(OrderService service, OrderQuery query, InvoiceService invoices, InvoiceQuery invoiceQuery,
                              AuditLogger audit) {
        this.service = service;
        this.query = query;
        this.invoices = invoices;
        this.invoiceQuery = invoiceQuery;
        this.audit = audit;
    }

    public OrderListResponse list(OrderQuery.Filter filter) {
        return query.search(filter);
    }

    public OrderResponse get(UUID id) {
        return query.detail(id);
    }

    /** Gửi lại cùng id không tạo trùng; chỉ ghi lịch sử khi đơn mới thật sự được tạo. */
    public OrderResponse create(OrderRequest req, Actor actor) {
        boolean isNew = !service.exists(req.id());
        OrderResponse r = query.detail(service.create(req, actor).getId());
        if (isNew) {
            log(actor, r, "Tạo", "Tạo đơn đặt hàng " + r.code());
        }
        return r;
    }

    public OrderResponse update(UUID id, OrderRequest req, Actor actor) {
        OrderResponse r = query.detail(service.update(id, req, actor).getId());
        log(actor, r, "Sửa", "Cập nhật đơn đặt hàng " + r.code());
        return r;
    }

    public OrderResponse confirm(UUID id, Actor actor) {
        OrderResponse r = query.detail(service.confirm(id, actor).getId());
        log(actor, r, "Xác nhận", "Xác nhận đơn đặt hàng " + r.code());
        return r;
    }

    public OrderResponse finish(UUID id, Actor actor) {
        OrderResponse r = query.detail(service.finish(id, actor).getId());
        log(actor, r, "Kết thúc", "Kết thúc đơn đặt hàng " + r.code() + " (chưa giao hết vẫn chuyển Hoàn thành)");
        return r;
    }

    public OrderResponse updateInfo(UUID id, OrderDtos.InfoRequest req, Actor actor) {
        OrderResponse r = query.detail(service.updateInfo(id, req, actor).getId());
        log(actor, r, "Sửa", "Cập nhật thông tin đơn đặt hàng " + r.code());
        return r;
    }

    public OrderDtos.ExportResponse export(OrderQuery.Filter filter) {
        return query.export(filter);
    }

    /**
     * refundMethod: CASH / TRANSFER / CARD / EWALLET (lập phiếu chi hoàn cọc), CREDIT (giữ cọc làm tiền trả trước)
     * hoặc CANCEL_VOUCHERS (hủy phiếu cọc).
     */
    public OrderResponse cancel(UUID id, String refundMethod, UUID bankAccountId, Actor actor) {
        if (refundMethod != null && !refundMethod.matches("CASH|TRANSFER|CARD|EWALLET|CREDIT|CANCEL_VOUCHERS")) {
            throw BusinessException.badRequest("REFUND_METHOD_INVALID", "Hình thức hoàn cọc không hợp lệ");
        }
        var before = query.detail(id).deposit();
        OrderResponse r = query.detail(service.cancel(id, refundMethod, bankAccountId, actor).getId());
        log(actor, r, "Hủy", "Hủy đơn đặt hàng " + r.code() + (before.signum() <= 0 ? "" : "CREDIT".equals(refundMethod)
                ? ", giữ tiền cọc " + Actor.money(before) + " làm công nợ (tiền khách trả trước)"
                : "CANCEL_VOUCHERS".equals(refundMethod) ? ", hủy phiếu cọc " + Actor.money(before)
                : ", hoàn tiền cọc " + Actor.money(before) + " (phiếu PC" + r.code() + ")"));
        return r;
    }

    /** Hóa đơn bán thường (trừ kho) gắn với đơn; tiền cọc tính vào khách đã trả. */
    public InvoiceResponse toInvoice(UUID id, InvoiceRequest req, Actor actor) {
        return invoiceQuery.detail(invoices.create(req.withOrderId(id), actor));
    }

    private void log(Actor actor, OrderResponse r, String action, String detail) {
        actor.audit(audit, r.branchId(), "Đặt hàng", action, r.code(), detail + ", khách " + r.customerName()
                + ", tổng " + Actor.money(r.total()) + ", khách đã trả " + Actor.money(r.deposit()));
    }
}
