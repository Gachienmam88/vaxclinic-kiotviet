package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.ShipmentDtos.ReturnOptions;
import com.vaxclinic.sales.invoice.Invoice;
import com.vaxclinic.sales.invoice.InvoiceRepository;
import com.vaxclinic.sales.salesreturn.SalesReturnDtos;
import com.vaxclinic.sales.salesreturn.SalesReturnService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.UUID;

/**
 * "Đã chuyển hoàn" (cửa hàng đã nhận lại hàng): phiếu trả hàng cho toàn bộ hàng còn lại của hóa đơn (hàng về kho, đi đường
 * SalesReturnService; id suy ra từ vận đơn → gọi lại không tạo trùng). Số khách đã trả trước:
 * CASH / TRANSFER = phiếu chi hoàn tiền; CREDIT = không hoàn, giữ làm tiền khách trả trước (công nợ khách âm / giảm).
 */
@Service
public class ShipmentReturnService {

    private final JdbcTemplate jdbc;
    private final InvoiceRepository invoices;
    private final SalesReturnService returns;

    public ShipmentReturnService(JdbcTemplate jdbc, InvoiceRepository invoices, SalesReturnService returns) {
        this.jdbc = jdbc;
        this.invoices = invoices;
        this.returns = returns;
    }

    /** Kiểm tra tham số TRƯỚC khi nhập kho (lỗi ở 1 vận đơn không làm hỏng vận đơn khác khi cập nhật hàng loạt). */
    public void validate(String code, UUID invoiceId, ReturnOptions opts) {
        if (opts.refundMethod() == null) {
            throw BusinessException.badRequest("REFUND_METHOD_REQUIRED",
                    code + ": chọn cách hoàn tiền khách đã trả (tiền mặt / chuyển khoản / giữ làm công nợ)");
        }
        if ("CREDIT".equals(opts.refundMethod())) {
            UUID customerId = jdbc.query("select customer_id from invoices where id = ?",
                    rs -> rs.next() ? rs.getObject(1, UUID.class) : null, invoiceId);
            if (customerId == null) {
                throw BusinessException.badRequest("WALK_IN_CREDIT", code + ": khách lẻ không giữ tiền làm công nợ được, hãy hoàn tiền");
            }
        }
    }

    /** Trả về id phiếu trả hàng (null nếu hóa đơn không còn hàng để trả). */
    public UUID create(UUID shipmentId, String code, UUID invoiceId, ReturnOptions opts, Actor actor) {
        Invoice inv = invoices.findWithLines(invoiceId).orElseThrow();
        var lines = new ArrayList<SalesReturnDtos.LineInput>();
        BigDecimal subtotal = BigDecimal.ZERO;
        for (var l : inv.getLines()) {
            BigDecimal left = l.getQuantity().subtract(jdbc.queryForObject("""
                    select coalesce(sum(rl.quantity), 0) from sales_return_lines rl join sales_returns r on r.id = rl.return_id
                    where rl.invoice_line_id = ? and r.status = 'COMPLETED'""", BigDecimal.class, l.getId()));
            if (left.signum() > 0) {
                lines.add(new SalesReturnDtos.LineInput(l.getId(), left, null));
                subtotal = subtotal.add(left.multiply(l.getUnitPrice().subtract(l.getDiscount())).setScale(0, RoundingMode.HALF_UP));
            }
        }
        if (lines.isEmpty()) {
            return null;
        }
        BigDecimal discount = inv.getDiscount().min(subtotal);
        boolean credit = "CREDIT".equals(opts.refundMethod());
        BigDecimal refund = credit ? BigDecimal.ZERO : inv.getPaid().min(subtotal.subtract(discount)).max(BigDecimal.ZERO);
        UUID returnId = UUID.nameUUIDFromBytes(("shipment-return:" + shipmentId).getBytes(StandardCharsets.UTF_8));
        returns.create(new SalesReturnDtos.ReturnRequest(returnId, invoiceId, java.time.Instant.now(), lines, discount,
                BigDecimal.ZERO, refund, credit ? null : opts.refundMethod(), "TRANSFER".equals(opts.refundMethod())
                ? opts.bankAccountId() : null, "Chuyển hoàn vận đơn " + code
                + (credit ? " (tiền khách đã trả giữ làm công nợ)" : "")), actor);
        return returnId;
    }
}
