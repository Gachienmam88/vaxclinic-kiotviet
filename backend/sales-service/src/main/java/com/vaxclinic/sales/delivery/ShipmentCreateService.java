package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.common.SalesRules;
import com.vaxclinic.sales.delivery.ShipmentDtos.CreateRequest;
import com.vaxclinic.sales.invoice.Invoice;
import com.vaxclinic.sales.invoice.InvoiceRepository;
import com.vaxclinic.sales.salesreturn.SalesReturnRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * "Tạo vận đơn" cho hóa đơn đã bán chưa có vận đơn đang hoạt động (VD vận đơn cũ đã hủy → giao lại qua đối tác khác).
 * Không đụng kho (hàng đã xuất khi bán). Thu hộ = khách cần trả − đã trả hiện tại. Khóa dòng hóa đơn + chỉ mục duy nhất
 * "1 vận đơn chưa hủy / hóa đơn" chống tạo trùng.
 */
@Service
public class ShipmentCreateService {

    private final SalesReturnRepository returns;
    private final InvoiceRepository invoices;
    private final ShipmentInvoiceHooks hooks;
    private final SalesRules rules;

    public ShipmentCreateService(SalesReturnRepository returns, InvoiceRepository invoices, ShipmentInvoiceHooks hooks,
                                 SalesRules rules) {
        this.returns = returns;
        this.invoices = invoices;
        this.hooks = hooks;
        this.rules = rules;
    }

    @Transactional
    public UUID create(CreateRequest req, Actor actor) {
        Invoice inv = invoices.findForUpdate(req.invoiceId())
                .orElseThrow(() -> BusinessException.notFound("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
        actor.checkBranch(inv.getBranchId());
        if (!"COMPLETED".equals(inv.getStatus())) {
            throw BusinessException.badRequest("INVOICE_NOT_COMPLETED", "Hóa đơn " + inv.getCode() + " đã hủy");
        }
        rules.checkNotLocked(inv.getBranchId(), Instant.now());
        if (hooks.statusOf(inv.getId()) != null) {
            throw BusinessException.badRequest("SHIPMENT_EXISTS", "Hóa đơn " + inv.getCode()
                    + " đang có vận đơn chưa hủy — hủy vận đơn đó trước khi tạo vận đơn mới");
        }
        Integer returned = returns.countCompletedByInvoice(inv.getId());
        if (returned != null && returned > 0) {
            throw BusinessException.badRequest("INVOICE_HAS_RETURNS", "Hóa đơn " + inv.getCode() + " đã có phiếu trả hàng, không tạo vận đơn được");
        }
        hooks.validate("DELIVERY", req.delivery());
        inv.setSaleMode("DELIVERY");
        return hooks.createForInvoice(inv, req.delivery(), actor);
    }
}
