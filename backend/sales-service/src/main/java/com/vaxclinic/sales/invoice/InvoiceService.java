package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.common.SalesRules;
import com.vaxclinic.sales.customer.Customer;
import com.vaxclinic.sales.customer.CustomerRepository;
import com.vaxclinic.sales.channel.SalesChannels;
import com.vaxclinic.sales.delivery.ShipmentInvoiceHooks;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceRequest;
import com.vaxclinic.sales.invoice.checkout.CheckoutAttemptService;
import com.vaxclinic.sales.order.OrderDepositLedger;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
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
    private final InvoiceWriter writer;
    private final InvoiceEditWriter editWriter;
    private final ProductStockClient stock;
    private final SalesRules rules;
    private final com.vaxclinic.common.audit.AuditLogger audit;
    private final OrderDepositLedger orderDeposits;
    private final ShipmentInvoiceHooks shipments;
    private final SalesChannels channels;
    private final CheckoutAttemptService checkouts;
    private final InvoiceChangeGuard guard;
    private final TaxReductionPlanner taxPlanner;

    public InvoiceService(InvoiceRepository invoices, CustomerRepository customers, InvoiceWriter writer,
                          InvoiceEditWriter editWriter, ProductStockClient stock, SalesRules rules,
                          com.vaxclinic.common.audit.AuditLogger audit, OrderDepositLedger orderDeposits,
                          ShipmentInvoiceHooks shipments, SalesChannels channels, CheckoutAttemptService checkouts,
                          InvoiceChangeGuard guard, TaxReductionPlanner taxPlanner) {
        this.taxPlanner = taxPlanner;
        this.checkouts = checkouts;
        this.orderDeposits = orderDeposits;
        this.shipments = shipments;
        this.channels = channels;
        this.invoices = invoices;
        this.customers = customers;
        this.writer = writer;
        this.editWriter = editWriter;
        this.stock = stock;
        this.rules = rules;
        this.audit = audit;
        this.guard = guard;
    }

    public UUID create(InvoiceRequest req, Actor actor) {
        return create(req, actor, null, null);
    }

    /**
     * Import hóa đơn từ file: fixedCode = mã hóa đơn trong file (đã kiểm tra chưa tồn tại); lineLots = số lô xuất cho từng
     * dòng (null / phần tử null = tự phân bổ FEFO). Còn lại đi đúng đường bán hàng thường (kho, phiếu thu, công nợ).
     */
    public UUID create(InvoiceRequest req, Actor actor, String fixedCode, List<String> lineLots) {
        if (invoices.existsById(req.id())) {
            return req.id();
        }
        actor.checkBranch(req.branchId());
        // Hóa đơn offline đồng bộ muộn mang ngày bán cũ: rơi vào kỳ đã khóa sổ → bị từ chối, giữ lại trên máy chờ xử lý.
        rules.checkNotLocked(req.branchId(), req.soldAt() == null ? Instant.now() : req.soldAt());
        shipments.validate(req.saleMode(), req.delivery());
        channels.resolve(req.salesChannel(), null);
        Customer customer = customerOf(req.customerId());
        var totals = InvoiceMath.totals(req.lines(), req.discount(), taxPlanner.plan(req.lines(), Boolean.TRUE.equals(req.taxReduction()), req.soldAt()));
        BigDecimal paid = paidOf(req, totals);
        BigDecimal due = totals.total(); // còn phải trả sau tiền cọc
        if (req.orderId() != null) { // từ đơn đặt hàng: tiền cọc trừ trước, khách chỉ trả phần còn lại
            BigDecimal deposit = orderDeposits.depositForInvoice(req.orderId(), req.id(), req.customerId(), req.branchId());
            due = totals.total().subtract(deposit.min(totals.total()));
            paid = paid.min(due);
        }
        // Thanh toán nhiều phương thức: khoản thêm không vượt số còn phải trả; phương thức chính nhận phần còn lại
        BigDecimal extras = InvoiceExtraPayments.sum(req.extraPayments());
        if (extras.compareTo(due) > 0) {
            if (req.orderId() != null) orderDeposits.releaseClaim(req.orderId(), req.id());
            throw BusinessException.badRequest("EXTRA_PAYMENT_EXCEEDS", "Tổng tiền các phương thức thanh toán thêm ("
                    + Actor.money(extras) + ") vượt quá số khách cần trả " + Actor.money(due));
        }
        paid = paid.min(due.subtract(extras));
        if (customer == null && paid.add(extras).compareTo(totals.total()) < 0
                && (req.delivery() == null || !req.delivery().collectsCod())) { // giao hàng có thu hộ: phần còn lại = thu hộ
            throw BusinessException.badRequest("WALK_IN_DEBT", "Khách lẻ phải thanh toán đủ — chọn khách hàng để ghi nợ");
        }
        // Mã HĐ lấy trước để ghi vào thẻ kho; nếu bước sau lỗi, mã bị bỏ qua (dãy số có thể nhảy cóc).
        String code = fixedCode != null ? fixedCode : "HD%06d".formatted(invoices.nextCodeNumber());
        // Line ids derived from the invoice id: a retry gets the SAME ids, matching the stored stock result (cost + lots).
        List<UUID> lineIds = IntStream.range(0, req.lines().size())
                .mapToObj(i -> UUID.nameUUIDFromBytes((req.id() + ":" + i).getBytes(StandardCharsets.UTF_8))).toList();
        String partner = customer == null ? "Khách lẻ" : customer.getName();
        UUID id;
        try {
            // Ghi nhận lần thanh toán TRƯỚC khi trừ kho → lưu hóa đơn lỗi mà không ai gửi lại thì job đối soát hoàn kho.
            UUID stockDocId = checkouts.begin(req, code, partner, actor, totals.total());
            var result = applySale(req.id(), new ProductStockClient.Request(stockDocId, "SALE", code, req.branchId(),
                    partner, actor.id(), null, stockLines(req, lineIds, lineLots)));
            id = writer.persist(req, actor, customer, code, lineIds, result, totals, paid);
        } catch (RuntimeException e) {
            if (req.orderId() != null) orderDeposits.releaseClaim(req.orderId(), req.id());
            throw e;
        }
        actor.audit(audit, req.branchId(), "Hóa đơn", "Tạo", code, "Tạo hóa đơn " + code + ", khách "
                + (customer == null ? "Khách lẻ" : customer.getCode() + " " + customer.getName()) + ", tổng "
                + Actor.money(totals.total()) + ", đã trả " + Actor.money(paid.add(extras)));
        return id;
    }

    /**
     * Sửa hóa đơn (nút "Chỉnh sửa" → màn bán hàng). Kho: SALE_REPLACE hoàn lô cũ + xuất lô mới trong 1 transaction.
     * docId chứng từ kho mới suy ra từ (id hóa đơn, revision mới) → gửi lại cùng revision không xuất kho 2 lần.
     */
    public UUID update(UUID id, int expectedRevision, InvoiceRequest req, Actor actor) {
        Invoice inv = find(id);
        guard.checkEditable(inv, expectedRevision, req, actor);
        Customer customer = customerOf(req.customerId());
        var totals = InvoiceMath.totals(req.lines(), req.discount(), taxPlanner.plan(req.lines(), Boolean.TRUE.equals(req.taxReduction()), inv.getSoldAt()));
        BigDecimal paid = guard.autoReceiptAmount(inv, req, customer, totals, paidOf(req, totals));
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
        // Kiểm tra TRƯỚC khi hoàn kho: còn phiếu thu nợ / phiếu trả hàng thì không cho hủy.
        guard.checkCancellable(inv, actor);
        stock.apply(new ProductStockClient.Request(inv.getStockDocId(), "SALE_CANCEL", inv.getCode(), inv.getBranchId(),
                inv.getCustomerName(), actor.id(), null, List.of()));
        writer.markCancelled(id, actor);
    }

    /** Sửa người bán / thời gian / kênh bán / ghi chú. Thiết lập "Không cho phép thay đổi thời gian giao dịch" chặn đổi thời gian. */
    public void updateInfo(UUID id, InvoiceDtos.InfoRequest req) {
        Invoice inv = find(id);
        rules.checkNotLocked(inv.getBranchId(), inv.getSoldAt());
        if (req.soldAt() != null && !req.soldAt().equals(inv.getSoldAt())) {
            if (rules.settings().sales().lockTransactionTime()) {
                throw BusinessException.badRequest("TIME_CHANGE_BLOCKED", "Cửa hàng không cho phép thay đổi thời gian giao dịch");
            }
            rules.checkNotLocked(inv.getBranchId(), req.soldAt());
        }
        String channel = req.salesChannel() == null ? null : channels.resolve(req.salesChannel(), inv.getSalesChannel());
        writer.updateInfo(id, req, channel);
    }

    /** Kho từ chối (4xx: thiếu tồn...) → chắc chắn chưa trừ gì → FAILED; lỗi mạng / timeout → giữ PENDING cho đối soát. */
    private ProductStockClient.Result applySale(UUID invoiceId, ProductStockClient.Request request) {
        try {
            return stock.apply(request);
        } catch (BusinessException e) {
            if (e.getStatus().is4xxClientError()) checkouts.markFailed(invoiceId, e.getCode() + ": " + e.getMessage());
            throw e;
        }
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

    private static List<ProductStockClient.Line> stockLines(InvoiceRequest req, List<UUID> lineIds) {
        return stockLines(req, lineIds, null);
    }

    /** lots[i] != null → product-service xuất đúng lô đó cho dòng i (hàng theo lô), không FEFO. */
    private static List<ProductStockClient.Line> stockLines(InvoiceRequest req, List<UUID> lineIds, List<String> lots) {
        return IntStream.range(0, req.lines().size()).mapToObj(i -> {
            var l = req.lines().get(i);
            String lot = lots == null ? null : lots.get(i);
            return lot == null ? ProductStockClient.Line.sale(lineIds.get(i), l.productId(), l.unitId(), l.quantity())
                    : new ProductStockClient.Line(lineIds.get(i), l.productId(), l.unitId(), l.quantity(), lot, null);
        }).toList();
    }
}
