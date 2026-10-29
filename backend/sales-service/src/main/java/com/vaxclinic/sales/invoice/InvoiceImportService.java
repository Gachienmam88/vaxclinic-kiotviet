package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.customer.CustomerDtos.CustomerRequest;
import com.vaxclinic.sales.customer.CustomerService;
import com.vaxclinic.sales.invoice.InvoiceDtos.ExtraPayment;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceRequest;
import com.vaxclinic.sales.invoice.InvoiceDtos.LineInput;
import com.vaxclinic.sales.invoice.InvoiceImportDtos.Created;
import com.vaxclinic.sales.invoice.InvoiceImportDtos.ImportError;
import com.vaxclinic.sales.invoice.InvoiceImportDtos.ImportRequest;
import com.vaxclinic.sales.invoice.InvoiceImportDtos.ImportResult;
import com.vaxclinic.sales.invoice.InvoiceImportDtos.ImportRow;
import com.vaxclinic.sales.invoice.InvoiceImportDtos.PlannedInvoice;
import com.vaxclinic.sales.invoice.InvoiceImportLookupClient.Lot;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.vaxclinic.sales.invoice.InvoiceImportCells.blank;
import static com.vaxclinic.sales.invoice.InvoiceImportCells.text;

/**
 * "Import file" hóa đơn. Quy tắc lưu: kiểm tra TOÀN BỘ file trước — có bất kỳ lỗi nào thì không lưu gì (trả danh sách lỗi
 * theo dòng). File hợp lệ → tạo lần lượt từng hóa đơn qua đúng đường bán hàng ({@link InvoiceService}: trừ kho đúng lô,
 * phiếu thu Tiền mặt / Thẻ / Chuyển khoản, công nợ khách), mỗi hóa đơn 1 transaction, giữ nguyên mã hóa đơn trong file.
 * Khách chưa có (có tên) được tạo khi lưu hóa đơn đầu tiên của khách đó.
 */
@Service
public class InvoiceImportService {

    private final InvoiceImportLookupClient lookups;
    private final InvoiceImportPlanner planner;
    private final InvoiceService invoices;
    private final CustomerService customers;

    public InvoiceImportService(InvoiceImportLookupClient lookups, InvoiceImportPlanner planner, InvoiceService invoices,
                                CustomerService customers) {
        this.lookups = lookups;
        this.planner = planner;
        this.invoices = invoices;
        this.customers = customers;
    }

    public ImportResult importRows(ImportRequest req, Actor actor, String token) {
        actor.checkBranch(req.branchId());
        var catalog = lookups.catalog(req.branchId(), token);
        var lotCache = new HashMap<UUID, List<Lot>>();
        var plan = planner.plan(req, actor, catalog, pid -> lotCache.computeIfAbsent(pid, x -> lookups.lots(x, token)),
                lookups.users(token));
        int count = plan.invoices().size();
        if (!plan.errors().isEmpty()) {
            var sorted = plan.errors().stream().sorted(Comparator.comparingInt(ImportError::line)).toList();
            return new ImportResult(count, List.of(), 0, sorted, null);
        }
        var created = new ArrayList<Created>();
        var newCustomers = new HashMap<String, UUID>();
        int skipped = 0;
        for (PlannedInvoice p : plan.invoices()) {
            if (p.alreadyImported()) {
                skipped++;
                continue;
            }
            try {
                UUID customerId = p.customerId() != null ? p.customerId() : p.newCustomer() == null ? null
                        : newCustomers.computeIfAbsent(customerKey(p.newCustomer()), k -> createCustomer(p.newCustomer(), req.branchId(), actor));
                var lots = p.lines().stream().map(InvoiceImportDtos.PlannedLine::lot).toList();
                UUID id = invoices.create(request(p, req.branchId(), customerId), actor, p.code(), lots);
                created.add(new Created(id, p.code()));
            } catch (BusinessException e) {
                return new ImportResult(count, created, skipped, List.of(), new ImportError(p.line(), "Hóa đơn " + p.code() + ": " + e.getMessage()));
            }
        }
        return new ImportResult(count, created, skipped, List.of(), null);
    }

    private static String customerKey(ImportRow r) {
        return (text(r.customerCode()) + "|" + text(r.phone()).replaceAll("\\D", "") + "|" + text(r.customerName())).toUpperCase();
    }

    private UUID createCustomer(ImportRow r, UUID branchId, Actor actor) {
        var c = customers.create(new CustomerRequest(blank(r.customerCode()) ? null : text(r.customerCode()), text(r.customerName()),
                blank(r.phone()) ? null : text(r.phone()), null, blank(r.email()) ? null : text(r.email()), null, null, null,
                blank(r.address()) ? null : text(r.address()), blank(r.area()) ? null : text(r.area()),
                blank(r.ward()) ? null : text(r.ward()), null, null, "PERSONAL", null, null, null, null, null, null, null, null,
                null, null, null, null, branchId, null, null, null, null, null), actor);
        return c.getId();
    }

    /**
     * Thanh toán: Thẻ (nếu có) là phương thức chính → phiếu thu TT{mã}, Tiền mặt / Chuyển khoản là khoản thêm TT{mã}-2...
     * (thứ tự này giữ đúng cột Thẻ / Chuyển khoản khi xuất file chi tiết).
     */
    private static InvoiceRequest request(PlannedInvoice p, UUID branchId, UUID customerId) {
        var methods = new ArrayList<Map.Entry<String, BigDecimal>>();
        if (p.card().signum() > 0) methods.add(Map.entry("CARD", p.card()));
        if (p.cash().signum() > 0) methods.add(Map.entry("CASH", p.cash()));
        if (p.transfer().signum() > 0) methods.add(Map.entry("TRANSFER", p.transfer()));
        String method = methods.isEmpty() ? "CASH" : methods.get(0).getKey();
        BigDecimal paid = methods.isEmpty() ? BigDecimal.ZERO : methods.get(0).getValue();
        var extras = methods.stream().skip(1).map(e -> new ExtraPayment(e.getKey(), e.getValue(), null)).toList();
        var lines = p.lines().stream().map(l -> new LineInput(l.product().id(), l.unit().id(), l.unit().code(), l.product().name(),
                l.unit().unitName(), l.quantity(), l.price(), l.discount(), null, l.product().taxCode())).toList();
        return new InvoiceRequest(p.id(), branchId, customerId, p.sellerId(), p.sellerName(), p.soldAt(), "QUICK", p.discount(),
                paid, method, null, p.note(), false, lines, null, p.priceBookId(), p.priceBookName(), p.channel(), null,
                extras.isEmpty() ? null : extras, null);
    }
}
