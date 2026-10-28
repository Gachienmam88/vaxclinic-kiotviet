package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.cashbook.CashVoucherRepository;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.customer.Customer;
import com.vaxclinic.sales.customer.CustomerRepository;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

/**
 * Điều phối bán hàng / sửa / hủy hóa đơn (KHÔNG mở transaction — có gọi HTTP sang product-service).
 * Thứ tự: kiểm tra mọi điều kiện → thao tác kho (idempotent) → ghi DB trong 1 transaction.
 * Lỗi ở bước ghi DB → gọi lại cùng tham số an toàn: kho trả kết quả cũ, không trừ/hoàn lần 2.
 */
@Service
public class InvoiceService {

    private final InvoiceRepository invoices;
    private final CustomerRepository customers;
    private final CashVoucherRepository vouchers;
    private final InvoiceWriter writer;
    private final InvoiceEditWriter editWriter;
    private final ProductStockClient stock;
    private final JdbcTemplate jdbc;

    public InvoiceService(InvoiceRepository invoices, CustomerRepository customers, CashVoucherRepository vouchers,
                          InvoiceWriter writer, InvoiceEditWriter editWriter, ProductStockClient stock, JdbcTemplate jdbc) {
        this.invoices = invoices;
        this.customers = customers;
        this.vouchers = vouchers;
        this.writer = writer;
        this.editWriter = editWriter;
        this.stock = stock;
        this.jdbc = jdbc;
    }

    public UUID create(InvoiceRequest req, Actor actor) {
        if (invoices.existsById(req.id())) {
            return req.id();
        }
        actor.checkBranch(req.branchId());
        Customer customer = customerOf(req.customerId());
        var totals = InvoiceMath.totals(req.lines(), req.discount());
        BigDecimal paid = paidOf(req, totals);
        if (customer == null && paid.compareTo(totals.total()) < 0) {
            throw BusinessException.badRequest("WALK_IN_DEBT", "Khách lẻ phải thanh toán đủ — chọn khách hàng để ghi nợ");
        }
        // Mã HĐ lấy trước để ghi vào thẻ kho; nếu bước sau lỗi, mã bị bỏ qua (dãy số có thể nhảy cóc).
        String code = "HD%06d".formatted(invoices.nextCodeNumber());
        List<UUID> lineIds = req.lines().stream().map(l -> UUID.randomUUID()).toList();
        var result = stock.apply(new ProductStockClient.Request(req.id(), "SALE", code, req.branchId(),
                customer == null ? "Khách lẻ" : customer.getName(), actor.id(), null, stockLines(req, lineIds)));
        return writer.persist(req, actor, customer, code, lineIds, result, totals, paid);
    }

    /**
     * Sửa hóa đơn (nút "Chỉnh sửa" → màn bán hàng). Kho: SALE_REPLACE hoàn lô cũ + xuất lô mới trong 1 transaction.
     * docId chứng từ kho mới suy ra từ (id hóa đơn, revision mới) → gửi lại cùng revision không xuất kho 2 lần.
     */
    public UUID update(UUID id, int expectedRevision, InvoiceRequest req, Actor actor) {
        Invoice inv = find(id);
        if (!"COMPLETED".equals(inv.getStatus())) {
            throw BusinessException.badRequest("INVOICE_NOT_EDITABLE", "Hóa đơn đã hủy, không sửa được");
        }
        if (inv.getRevision() != expectedRevision) {
            throw BusinessException.conflict("INVOICE_CHANGED", "Hóa đơn vừa được người khác sửa, hãy mở lại để sửa tiếp");
        }
        if (hasReturns(id)) {
            throw BusinessException.badRequest("INVOICE_HAS_RETURNS", "Hóa đơn đã có phiếu trả hàng, không sửa được");
        }
        actor.checkBranch(inv.getBranchId());
        Customer customer = customerOf(req.customerId());
        var totals = InvoiceMath.totals(req.lines(), req.discount());
        BigDecimal paid = paidOf(req, totals);
        if (customer == null && paid.compareTo(totals.total()) < 0) {
            throw BusinessException.badRequest("WALK_IN_DEBT", "Khách lẻ phải thanh toán đủ — chọn khách hàng để ghi nợ");
        }
        BigDecimal debtPayments = inv.getPaid().subtract(autoPaid(id)); // phiếu thu nợ (PT) đã phân bổ vào HĐ
        if (debtPayments.signum() > 0 && (!java.util.Objects.equals(inv.getCustomerId(), req.customerId())
                || totals.total().compareTo(debtPayments.add(paid)) < 0)) {
            throw BusinessException.badRequest("INVOICE_HAS_PAYMENTS",
                    "Hóa đơn đã có phiếu thu nợ " + debtPayments + "đ: không đổi khách / không giảm tổng dưới số đã thu");
        }
        int revision = expectedRevision + 1;
        UUID docId = UUID.nameUUIDFromBytes((id + ":" + revision).getBytes(StandardCharsets.UTF_8));
        List<UUID> lineIds = IntStream.range(0, req.lines().size())
                .mapToObj(i -> UUID.nameUUIDFromBytes((docId + ":" + i).getBytes(StandardCharsets.UTF_8))).toList();
        var result = stock.apply(new ProductStockClient.Request(docId, "SALE_REPLACE", inv.getCode(), inv.getBranchId(),
                customer == null ? "Khách lẻ" : customer.getName(), actor.id(), inv.getStockDocId(), stockLines(req, lineIds)));
        editWriter.apply(id, expectedRevision, docId, req, customer, lineIds, result, totals, paid, actor);
        return id;
    }

    public void cancel(UUID id, Actor actor) {
        Invoice inv = find(id);
        if ("CANCELLED".equals(inv.getStatus())) {
            return;
        }
        actor.checkBranch(inv.getBranchId());
        // Kiểm tra TRƯỚC khi hoàn kho: còn phiếu thu nợ / phiếu trả hàng thì không cho hủy.
        if (inv.getPaid().compareTo(autoPaid(id)) > 0) {
            throw BusinessException.badRequest("INVOICE_HAS_PAYMENTS",
                    "Hóa đơn đã có phiếu thu nợ phân bổ, hãy hủy các phiếu thu đó trước");
        }
        if (hasReturns(id)) {
            throw BusinessException.badRequest("INVOICE_HAS_RETURNS", "Hóa đơn đã có phiếu trả hàng, hãy hủy phiếu trả trước");
        }
        stock.apply(new ProductStockClient.Request(inv.getStockDocId(), "SALE_CANCEL", inv.getCode(), inv.getBranchId(),
                inv.getCustomerName(), actor.id(), null, List.of()));
        writer.markCancelled(id);
    }

    private Invoice find(UUID id) {
        return invoices.findById(id)
                .orElseThrow(() -> BusinessException.notFound("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn"));
    }

    private Customer customerOf(UUID customerId) {
        return customerId == null ? null : customers.findById(customerId)
                .orElseThrow(() -> BusinessException.badRequest("CUSTOMER_NOT_FOUND", "Khách hàng không tồn tại"));
    }

    private static BigDecimal paidOf(InvoiceRequest req, InvoiceMath.Totals totals) {
        return InvoiceMath.money(req.paidAmount() == null ? totals.total() : req.paidAmount()).min(totals.total());
    }

    private BigDecimal autoPaid(UUID invoiceId) {
        return vouchers.findBySourceTypeAndSourceId("INVOICE", invoiceId)
                .filter(v -> "PAID".equals(v.getStatus())).map(v -> v.getAmount()).orElse(BigDecimal.ZERO);
    }

    private boolean hasReturns(UUID invoiceId) {
        Integer n = jdbc.queryForObject("select count(*) from sales_returns where invoice_id = ? and status = 'COMPLETED'",
                Integer.class, invoiceId);
        return n != null && n > 0;
    }

    private static List<ProductStockClient.Line> stockLines(InvoiceRequest req, List<UUID> lineIds) {
        return IntStream.range(0, req.lines().size()).mapToObj(i -> ProductStockClient.Line.sale(lineIds.get(i),
                req.lines().get(i).productId(), req.lines().get(i).unitId(), req.lines().get(i).quantity())).toList();
    }
}
