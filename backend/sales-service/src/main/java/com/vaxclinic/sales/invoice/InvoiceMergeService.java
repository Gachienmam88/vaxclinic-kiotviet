package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.common.SalesRules;
import com.vaxclinic.sales.invoice.InvoiceMergeDtos.CandidateGroup;
import com.vaxclinic.sales.invoice.InvoiceMergeDtos.CandidatesResponse;
import com.vaxclinic.sales.invoice.InvoiceMergeDtos.MergeRequest;
import com.vaxclinic.sales.invoice.InvoiceMergeDtos.Row;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * "Gộp đơn" (KiotViet): hóa đơn cùng khách trong 7 ngày qua → 1 hóa đơn mới giữ nguyên dòng hàng + lô, cộng dồn thanh toán;
 * hóa đơn gốc chuyển Đã hủy (merged_into_id = hóa đơn gộp). Không mở transaction (gọi product-service):
 * kiểm tra → kho SALE_MERGE (idempotent, tồn không đổi) → ghi DB 1 transaction ({@link InvoiceMergeWriter}).
 * Chặn gộp: đã trả hàng, có vận đơn, đã phát hành HĐĐT, đơn đặt hàng liên quan chưa hoàn thành, có phiếu thu nợ / tiền cọc.
 */
@Service
public class InvoiceMergeService {

    private final InvoiceMergeRepository merges;
    private final InvoiceRepository invoices;
    private final InvoiceMergeWriter writer;
    private final ProductStockClient stock;
    private final EInvoiceLookupClient einvoices;
    private final SalesRules rules;
    private final AuditLogger audit;
    private final InvoiceQuery query;

    public InvoiceMergeService(InvoiceMergeRepository merges, InvoiceRepository invoices, InvoiceMergeWriter writer,
                               ProductStockClient stock, EInvoiceLookupClient einvoices, SalesRules rules, AuditLogger audit,
                               InvoiceQuery query) {
        this.merges = merges;
        this.invoices = invoices;
        this.writer = writer;
        this.stock = stock;
        this.einvoices = einvoices;
        this.rules = rules;
        this.audit = audit;
        this.query = query;
    }

    /** Nhóm hóa đơn gộp được (≥ 2 hóa đơn cùng khách); không có nhóm nào → reason. */
    public CandidatesResponse candidates(UUID branchId, Actor actor) {
        actor.checkBranch(branchId);
        Set<UUID> published = publishedEInvoices();
        var groups = new LinkedHashMap<String, List<Row>>();
        boolean orderBlocked = false;
        for (Row r : merges.recent(branchId, since())) {
            String blocked = blockReason(r, published);
            orderBlocked |= "ORDER_NOT_COMPLETED".equals(blocked);
            if (blocked == null) {
                groups.computeIfAbsent(r.groupKey(), k -> new ArrayList<>()).add(r);
            }
        }
        var out = groups.entrySet().stream().filter(e -> e.getValue().size() >= 2)
                .map(e -> new CandidateGroup(e.getKey(), e.getValue().get(0).customerCode(), e.getValue().get(0).customerName(),
                        e.getValue().stream().map(Row::candidate).toList())).toList();
        return new CandidatesResponse(out, out.isEmpty() ? (orderBlocked ? "ORDER_NOT_COMPLETED" : "NO_CANDIDATES") : null);
    }

    public InvoiceDtos.InvoiceResponse merge(MergeRequest req, Actor actor) {
        if (invoices.existsById(req.id())) { // gửi lại cùng id: đã gộp xong
            return query.detail(req.id());
        }
        actor.checkBranch(req.branchId());
        List<UUID> ids = req.invoiceIds().stream().distinct().toList();
        if (ids.size() < 2) {
            throw BusinessException.badRequest("MERGE_TOO_FEW", "Chọn ít nhất 2 hóa đơn để gộp");
        }
        List<Row> rows = merges.byIds(ids);
        if (rows.size() != ids.size()) {
            throw BusinessException.badRequest("INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn cần gộp");
        }
        Set<UUID> published = publishedEInvoices();
        Instant since = since();
        for (Row r : rows) {
            String blocked = blockReason(r, published);
            if (blocked != null) {
                throw BusinessException.badRequest("MERGE_NOT_ALLOWED", "Hóa đơn " + r.code() + " không gộp được: " + message(blocked));
            }
            if (r.soldAt().isBefore(since)) {
                throw BusinessException.badRequest("MERGE_NOT_ALLOWED", "Hóa đơn " + r.code() + " không gộp được: quá 7 ngày");
            }
        }
        if (rows.stream().map(Row::groupKey).distinct().count() > 1) {
            throw BusinessException.badRequest("MERGE_DIFFERENT_CUSTOMERS", "Chỉ gộp được các hóa đơn của cùng 1 khách hàng");
        }
        var originals = rows.stream().map(r -> invoices.findWithLines(r.id()).orElseThrow())
                .sorted(Comparator.comparing(Invoice::getSoldAt).thenComparing(Invoice::getCode)).toList();
        for (Invoice inv : originals) {
            if (!"COMPLETED".equals(inv.getStatus())) {
                throw BusinessException.badRequest("MERGE_NOT_ALLOWED", "Hóa đơn " + inv.getCode() + " đã hủy hoặc đã được gộp");
            }
            if (!inv.getBranchId().equals(req.branchId())) {
                throw BusinessException.badRequest("MERGE_DIFFERENT_BRANCH", "Hóa đơn " + inv.getCode() + " thuộc chi nhánh khác");
            }
            rules.checkNotLocked(inv.getBranchId(), inv.getSoldAt()); // hủy hóa đơn gốc trong kỳ đã khóa sổ → chặn
        }
        String code = "HD%06d".formatted(invoices.nextCodeNumber());
        var lineIds = new ArrayList<UUID>();
        var stockLines = new ArrayList<ProductStockClient.MergeLine>();
        for (Invoice inv : originals) {
            for (InvoiceLine l : inv.getLines()) {
                UUID lineId = UUID.nameUUIDFromBytes((req.id() + ":" + lineIds.size()).getBytes(StandardCharsets.UTF_8));
                lineIds.add(lineId);
                stockLines.add(new ProductStockClient.MergeLine(lineId, l.getId()));
            }
        }
        stock.applyMerge(new ProductStockClient.MergeRequest(req.id(), code, req.branchId(), originals.get(0).getCustomerName(),
                actor.id(), originals.stream().map(Invoice::getStockDocId).toList(), stockLines));
        Invoice merged = writer.persist(req.id(), code, originals, lineIds, actor);
        actor.audit(audit, merged.getBranchId(), "Hóa đơn", "Gộp đơn", code, "Gộp hóa đơn "
                + String.join(", ", originals.stream().map(Invoice::getCode).toList()) + " thành " + code + ", khách "
                + merged.getCustomerName() + ", tổng " + Actor.money(merged.getTotal()) + ", đã trả " + Actor.money(merged.getPaid()));
        return query.detail(merged.getId());
    }

    /** null = gộp được; còn lại = mã lý do chặn. */
    private static String blockReason(Row r, Set<UUID> published) {
        if (r.orderStatus() != null && !"COMPLETED".equals(r.orderStatus())) return "ORDER_NOT_COMPLETED";
        if (r.hasReturn()) return "HAS_RETURN";
        if (r.hasShipment()) return "HAS_SHIPMENT";
        if (published.contains(r.id())) return "EINVOICE_PUBLISHED";
        if (r.foreignPayment()) return "FOREIGN_PAYMENT";
        return null;
    }

    private static String message(String reason) {
        return switch (reason) {
            case "ORDER_NOT_COMPLETED" -> "phiếu đặt hàng liên quan có trạng thái khác hoàn thành";
            case "HAS_RETURN" -> "đã có phiếu trả hàng";
            case "HAS_SHIPMENT" -> "hóa đơn giao hàng (có vận đơn)";
            case "EINVOICE_PUBLISHED" -> "đã phát hành hóa đơn điện tử";
            default -> "đã có phiếu thu nợ / tiền cọc đặt hàng phân bổ vào hóa đơn";
        };
    }

    /** Hóa đơn đã phát hành HĐĐT (PUBLISHED / ACCEPTED) — integration-service không trả lời thì không cho gộp. */
    private Set<UUID> publishedEInvoices() {
        var byStatus = einvoices.idsByStatus();
        var out = new HashSet<UUID>(byStatus.getOrDefault("PUBLISHED", List.of()));
        out.addAll(byStatus.getOrDefault("ACCEPTED", List.of()));
        return out;
    }

    private static Instant since() {
        return Instant.now().minus(Duration.ofDays(InvoiceMergeDtos.WINDOW_DAYS));
    }
}
