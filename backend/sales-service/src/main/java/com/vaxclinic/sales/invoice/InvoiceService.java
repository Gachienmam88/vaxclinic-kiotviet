package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.cashbook.CashVoucherRepository;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.customer.Customer;
import com.vaxclinic.sales.customer.CustomerRepository;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

/**
 * Điều phối bán hàng / hủy hóa đơn (KHÔNG mở transaction — có gọi HTTP sang product-service).
 * Thứ tự: kiểm tra mọi điều kiện → trừ/hoàn kho (idempotent) → InvoiceWriter lưu trong 1 transaction.
 * Nếu bước lưu lỗi, gọi lại cùng id an toàn: kho trả kết quả cũ, không trừ lần 2.
 */
@Service
public class InvoiceService {

    private final InvoiceRepository invoices;
    private final CustomerRepository customers;
    private final CashVoucherRepository vouchers;
    private final InvoiceWriter writer;
    private final ProductStockClient stock;

    public InvoiceService(InvoiceRepository invoices, CustomerRepository customers, CashVoucherRepository vouchers,
                          InvoiceWriter writer, ProductStockClient stock) {
        this.invoices = invoices;
        this.customers = customers;
        this.vouchers = vouchers;
        this.writer = writer;
        this.stock = stock;
    }

    public UUID create(InvoiceRequest req, Actor actor) {
        if (invoices.existsById(req.id())) {
            return req.id();
        }
        actor.checkBranch(req.branchId());
        Customer customer = req.customerId() == null ? null : customers.findById(req.customerId())
                .orElseThrow(() -> BusinessException.badRequest("CUSTOMER_NOT_FOUND", "Khách hàng không tồn tại"));
        var totals = InvoiceMath.totals(req.lines(), req.discount());
        BigDecimal paid = InvoiceMath.money(req.paidAmount() == null ? totals.total() : req.paidAmount()).min(totals.total());
        if (customer == null && paid.compareTo(totals.total()) < 0) {
            throw BusinessException.badRequest("WALK_IN_DEBT", "Khách lẻ phải thanh toán đủ — chọn khách hàng để ghi nợ");
        }
        // Mã HĐ lấy trước để ghi vào thẻ kho; nếu bước sau lỗi, mã bị bỏ qua (dãy số có thể nhảy cóc).
        String code = "HD%06d".formatted(invoices.nextCodeNumber());
        List<UUID> lineIds = req.lines().stream().map(l -> UUID.randomUUID()).toList();
        var stockLines = IntStream.range(0, req.lines().size()).mapToObj(i -> new ProductStockClient.Line(
                lineIds.get(i), req.lines().get(i).productId(), req.lines().get(i).unitId(), req.lines().get(i).quantity())).toList();
        var result = stock.apply(new ProductStockClient.Request(req.id(), "SALE", code, req.branchId(),
                customer == null ? "Khách lẻ" : customer.getName(), actor.id(), stockLines));
        return writer.persist(req, actor, customer, code, lineIds, result, totals, paid);
    }

    public void cancel(UUID id, Actor actor) {
        Invoice inv = invoices.findById(id)
                .orElseThrow(() -> BusinessException.notFound("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
        if ("CANCELLED".equals(inv.getStatus())) {
            return;
        }
        actor.checkBranch(inv.getBranchId());
        // Kiểm tra TRƯỚC khi hoàn kho: còn phiếu thu nợ (ngoài phiếu TT tự động) phân bổ vào HĐ thì không cho hủy.
        BigDecimal autoPaid = vouchers.findBySourceTypeAndSourceId("INVOICE", id)
                .filter(v -> "PAID".equals(v.getStatus())).map(v -> v.getAmount()).orElse(BigDecimal.ZERO);
        if (inv.getPaid().compareTo(autoPaid) > 0) {
            throw BusinessException.badRequest("INVOICE_HAS_PAYMENTS",
                    "Hóa đơn đã có phiếu thu nợ phân bổ, hãy hủy các phiếu thu đó trước");
        }
        stock.apply(new ProductStockClient.Request(id, "SALE_CANCEL", inv.getCode(), inv.getBranchId(),
                inv.getCustomerName(), actor.id(), List.of()));
        writer.markCancelled(id);
    }
}
