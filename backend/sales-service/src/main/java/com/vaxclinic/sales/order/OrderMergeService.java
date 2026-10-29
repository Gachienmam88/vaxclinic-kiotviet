package com.vaxclinic.sales.order;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.common.SalesRules;
import com.vaxclinic.sales.invoice.InvoiceDtos.LineInput;
import com.vaxclinic.sales.invoice.InvoiceMath;
import com.vaxclinic.sales.order.OrderDtos.MergeGroup;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * "Gộp đơn" đặt hàng: các đơn mở (Phiếu tạm / Đã xác nhận, chưa có hóa đơn) của cùng 1 khách, cùng chi nhánh, tạo trong 7 ngày qua
 * gộp vào ĐƠN CŨ NHẤT (giữ mã, ngày đặt, người nhận đặt, kênh bán, bảng giá, dự kiến giao, khu vực). Dòng cùng hàng + đơn vị +
 * đơn giá + giảm giá dòng cộng dồn số lượng, còn lại giữ riêng; giảm giá đơn = tổng giảm giá các đơn; ghi chú nối lại.
 * Phiếu thu cọc của đơn khác chuyển sang đơn gộp (không hủy, không hoàn) → công nợ khách và sổ quỹ không đổi.
 * Đơn khác → Đã hủy, merged_into_id = đơn gộp, tiền cọc 0.
 */
@Service
public class OrderMergeService {

    /** Số ngày tính lùi (theo thời điểm tạo đơn) như "Gộp đơn" hóa đơn. */
    static final int WINDOW_DAYS = 7;

    private final OrderMergeRepository merges;
    private final CustomerOrderRepository orders;
    private final SalesRules rules;

    public OrderMergeService(OrderMergeRepository merges, CustomerOrderRepository orders, SalesRules rules) {
        this.merges = merges;
        this.orders = orders;
        this.rules = rules;
    }

    public OrderDtos.MergeCandidatesResponse candidates(UUID branchId, Actor actor) {
        actor.checkBranch(branchId);
        var groups = new LinkedHashMap<UUID, List<OrderMergeRepository.Row>>();
        for (var r : merges.open(branchId, since())) {
            groups.computeIfAbsent(r.customerId(), k -> new ArrayList<>()).add(r);
        }
        return new OrderDtos.MergeCandidatesResponse(groups.values().stream().filter(g -> g.size() >= 2).map(g -> {
            var first = g.get(0);
            return new MergeGroup(first.customerId(), first.customerCode(), first.customerName(), first.customerPhone(),
                    g.stream().map(OrderMergeRepository.Row::order).toList());
        }).toList());
    }

    /** Gộp xong trả đơn gộp. Gửi lại đúng các đơn đã gộp (mạng chập chờn) → trả đơn gộp, không gộp lại. */
    @Transactional
    public CustomerOrder merge(OrderDtos.MergeRequest req, Actor actor) {
        actor.checkBranch(req.branchId());
        List<UUID> ids = req.orderIds().stream().distinct().toList();
        if (ids.size() < 2) {
            throw BusinessException.badRequest("MERGE_TOO_FEW", "Chọn ít nhất 2 đơn để gộp");
        }
        var list = new ArrayList<CustomerOrder>();
        for (UUID id : ids) {
            list.add(orders.findForUpdate(id)
                    .orElseThrow(() -> BusinessException.badRequest("ORDER_NOT_FOUND", "Không tìm thấy đơn đặt hàng cần gộp")));
        }
        list.sort(Comparator.comparing(CustomerOrder::getOrderedAt).thenComparing(CustomerOrder::getCode));
        CustomerOrder target = list.get(0);
        var others = list.subList(1, list.size());
        if (target.isOpen() && others.stream().allMatch(o -> target.getId().equals(o.getMergedIntoId()))) {
            return target;
        }
        Instant since = since();
        // Kiểm lại ở server mọi điều kiện của danh sách ứng viên (không tin client): đơn đang được lập hóa đơn → không gộp
        List<String> busy = merges.beingInvoiced(ids);
        if (!busy.isEmpty()) {
            throw BusinessException.badRequest("MERGE_NOT_ALLOWED", "Đơn " + busy.get(0) + " không gộp được: đang được lập hóa đơn");
        }
        for (CustomerOrder o : list) {
            check(o, target, req.branchId(), since);
            rules.checkNotLocked(o.getBranchId(), o.getOrderedAt()); // đơn gốc bị hủy trong kỳ đã khóa sổ → chặn
        }
        rules.checkNotLocked(req.branchId(), Instant.now());

        var lines = mergedLines(list);
        BigDecimal discount = list.stream().map(CustomerOrder::getDiscount).reduce(BigDecimal.ZERO, BigDecimal::add);
        var totals = InvoiceMath.totals(lines, discount);
        BigDecimal moved = others.stream().map(CustomerOrder::getDeposit).reduce(BigDecimal.ZERO, BigDecimal::add);
        String note = String.join(" | ", list.stream().map(CustomerOrder::getNote).filter(n -> n != null && !n.isBlank())
                .distinct().toList());

        target.getLines().clear();
        orders.flush();
        for (int i = 0; i < lines.size(); i++) {
            target.getLines().add(line(target, i + 1, lines.get(i)));
        }
        target.setSubtotal(totals.subtotal());
        target.setDiscount(totals.discount());
        target.setTotal(totals.total());
        target.setNote(note.isEmpty() ? null : note);
        target.setDeposit(target.getDeposit().add(moved));
        merges.moveReceipts(others.stream().map(CustomerOrder::getId).toList(), target.getId());
        Instant now = Instant.now();
        for (CustomerOrder o : others) {
            o.setStatus("CANCELLED");
            o.setCancelledAt(now);
            o.setMergedIntoId(target.getId());
            o.setDeposit(BigDecimal.ZERO);
        }
        orders.flush();
        return target;
    }

    private static void check(CustomerOrder o, CustomerOrder target, UUID branchId, Instant since) {
        String why = !o.isOpen() ? "đã hoàn thành hoặc đã hủy"
                : o.getInvoiceId() != null ? "đã có hóa đơn"
                : !o.getBranchId().equals(branchId) ? "thuộc chi nhánh khác"
                : o.getCreatedAt().isBefore(since) ? "tạo quá " + WINDOW_DAYS + " ngày"
                : null;
        if (why != null) {
            throw BusinessException.badRequest("MERGE_NOT_ALLOWED", "Đơn " + o.getCode() + " không gộp được: " + why);
        }
        if (!Objects.equals(o.getCustomerId(), target.getCustomerId())) {
            throw BusinessException.badRequest("MERGE_DIFFERENT_CUSTOMERS", "Chỉ gộp được các đơn của cùng 1 khách hàng");
        }
    }

    /** Dòng của mọi đơn theo thứ tự đơn → dòng; cùng hàng + đơn vị + đơn giá + giảm giá dòng thì cộng số lượng. */
    private static List<LineInput> mergedLines(List<CustomerOrder> list) {
        var byKey = new LinkedHashMap<String, LineInput>();
        for (CustomerOrder o : list) {
            for (CustomerOrderLine l : o.getLines()) {
                String key = l.getProductId() + "|" + l.getUnitId() + "|" + l.getUnitPrice().stripTrailingZeros().toPlainString()
                        + "|" + l.getDiscount().stripTrailingZeros().toPlainString();
                byKey.merge(key, new LineInput(l.getProductId(), l.getUnitId(), l.getProductCode(), l.getProductName(),
                        l.getUnitName(), l.getQuantity(), l.getUnitPrice(), l.getDiscount(), l.getNote(), l.getTaxCode(), null),
                        (a, b) -> new LineInput(a.productId(), a.unitId(), a.productCode(), a.productName(), a.unitName(),
                                a.quantity().add(b.quantity()), a.unitPrice(), a.discount(), a.note(), a.taxCode(), null));
            }
        }
        return new ArrayList<>(byKey.values());
    }

    private static CustomerOrderLine line(CustomerOrder o, int no, LineInput in) {
        var line = new CustomerOrderLine();
        line.setId(UUID.randomUUID());
        line.setOrder(o);
        line.setLineNo(no);
        line.setProductId(in.productId());
        line.setUnitId(in.unitId());
        line.setProductCode(in.productCode());
        line.setProductName(in.productName());
        line.setUnitName(in.unitName());
        line.setQuantity(in.quantity());
        line.setUnitPrice(in.unitPrice());
        line.setDiscount(in.discount());
        line.setNote(in.note());
        line.setTaxCode(in.taxCode());
        return line;
    }

    private static Instant since() {
        return Instant.now().minus(Duration.ofDays(WINDOW_DAYS));
    }
}
