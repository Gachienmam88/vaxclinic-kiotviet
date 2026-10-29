package com.vaxclinic.sales.salesreturn;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.salesreturn.SalesReturnDtos.ReturnRequest;
import com.vaxclinic.sales.salesreturn.SalesReturnDtos.ReturnResponse;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;

/**
 * Trả hàng cho màn hình: danh sách / chi tiết, tạo / hủy phiếu (nghiệp vụ ở {@link SalesReturnService}),
 * trả chi tiết đọc lại sau khi ghi xong rồi ghi lịch sử thao tác.
 */
@Service
public class SalesReturnManageService {

    private static final String FEATURE = "Trả hàng";

    private final SalesReturnService service;
    private final SalesReturnWriter writer;
    private final SalesReturnQueryRepository query;
    private final AuditLogger audit;

    public SalesReturnManageService(SalesReturnService service, SalesReturnWriter writer, SalesReturnQueryRepository query,
                                    AuditLogger audit) {
        this.service = service;
        this.writer = writer;
        this.query = query;
        this.audit = audit;
    }

    /** Kết quả {items, total, sumTotal}; tối đa 100 dòng / trang (offset tính theo size gửi lên, giữ như cũ). */
    public Map<String, Object> list(SalesReturnQueryRepository.Filter filter, int page, int size) {
        var r = query.list(filter, Math.min(Math.max(size, 1), 100), (long) Math.max(page, 0) * size);
        return Map.of("items", r.items(), "total", r.total(), "sumTotal", r.sumTotal());
    }

    public SalesReturnDtos.ExportResponse export(SalesReturnQueryRepository.Filter filter) {
        return query.export(filter);
    }

    public ReturnResponse get(UUID id) {
        var lines = query.lines(id);
        writer.find(id); // 404 nếu không có
        return query.detail(id, lines);
    }

    /** Gửi lại cùng id trả về phiếu đã tạo; chỉ ghi lịch sử khi phiếu mới thật sự được tạo. */
    public ReturnResponse create(ReturnRequest req, Actor actor, String bearerToken) {
        boolean existed = writer.exists(req.id());
        ReturnResponse r = get(service.create(req, actor, bearerToken));
        if (!existed) {
            actor.audit(audit, r.branchId(), FEATURE, "Tạo", r.code(), "Tạo phiếu trả hàng " + r.code()
                    + (r.invoiceCode() == null ? " (trả nhanh)" : " theo hóa đơn " + r.invoiceCode())
                    + ", khách " + r.customerName() + ", cần trả khách " + Actor.money(r.total()));
        }
        return r;
    }

    public ReturnResponse cancel(UUID id, Actor actor) {
        service.cancel(id, actor);
        ReturnResponse r = get(id);
        actor.audit(audit, r.branchId(), FEATURE, "Hủy", r.code(), "Hủy phiếu trả hàng " + r.code()
                + (r.invoiceCode() == null ? " (trả nhanh)" : " của hóa đơn " + r.invoiceCode()));
        return r;
    }
}
