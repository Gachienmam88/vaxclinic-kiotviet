package com.vaxclinic.sales.order;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.common.SalesRules;
import com.vaxclinic.sales.customer.Customer;
import com.vaxclinic.sales.customer.CustomerRepository;
import com.vaxclinic.sales.invoice.InvoiceDtos.LineInput;
import com.vaxclinic.sales.invoice.InvoiceMath;
import com.vaxclinic.sales.order.OrderDtos.OrderRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Đặt hàng: tạo (Phiếu tạm) / sửa / xác nhận / hủy. Không đụng kho — kho chỉ trừ khi "Tạo hóa đơn"
 * (đi đường bán hàng thường, xem InvoiceService + OrderDepositLedger.attach).
 * Khóa sổ: tạo / hủy kiểm tra thời điểm hiện tại (phiếu thu/chi phát sinh lúc đó), sửa / xác nhận kiểm tra ngày đặt.
 */
@Service
public class OrderService {

    private final CustomerOrderRepository orders;
    private final CustomerRepository customers;
    private final OrderDepositLedger deposits;
    private final SalesRules rules;

    public OrderService(CustomerOrderRepository orders, CustomerRepository customers, OrderDepositLedger deposits,
                        SalesRules rules) {
        this.orders = orders;
        this.customers = customers;
        this.deposits = deposits;
        this.rules = rules;
    }

    @Transactional
    public CustomerOrder create(OrderRequest req, Actor actor) {
        var existing = orders.findById(req.id());
        if (existing.isPresent()) { // gửi lại cùng id (mạng chập chờn): trả đơn đã tạo
            return existing.get();
        }
        actor.checkBranch(req.branchId());
        Instant now = Instant.now();
        rules.checkNotLocked(req.branchId(), now);
        Customer customer = customer(req.customerId());
        var totals = InvoiceMath.totals(req.lines(), req.discount());
        var o = new CustomerOrder();
        o.setId(req.id());
        o.setCode("DH%06d".formatted(orders.nextCodeNumber()));
        o.setBranchId(req.branchId());
        o.setCreatedBy(actor.id());
        o.setCreatedByName(actor.name());
        o.setOrderedAt(now);
        apply(o, req, customer, totals, actor);
        orders.saveAndFlush(o);
        BigDecimal paid = paidNow(req, totals, BigDecimal.ZERO);
        if (paid.signum() > 0) {
            deposits.receive(o, customer, paid, req.paymentMethod(), req.bankAccountId(), actor);
        }
        return o;
    }

    /** Sửa đơn Phiếu tạm / Đã xác nhận (màn bán hàng). Đã có cọc thì không đổi khách, tổng không nhỏ hơn số đã trả. */
    @Transactional
    public CustomerOrder update(UUID id, OrderRequest req, Actor actor) {
        CustomerOrder o = openForUpdate(id, actor);
        rules.checkNotLocked(o.getBranchId(), o.getOrderedAt());
        if (o.getDeposit().signum() > 0 && !Objects.equals(o.getCustomerId(), req.customerId())) {
            throw BusinessException.badRequest("ORDER_HAS_DEPOSIT", "Đơn đã có tiền đặt cọc, không đổi khách hàng được");
        }
        Customer customer = customer(req.customerId());
        var totals = InvoiceMath.totals(req.lines(), req.discount());
        BigDecimal paid = paidNow(req, totals, o.getDeposit());
        if (totals.total().compareTo(o.getDeposit()) < 0) {
            throw BusinessException.badRequest("ORDER_TOTAL_BELOW_DEPOSIT",
                    "Khách đã trả " + Actor.money(o.getDeposit()) + ", tổng đơn không được nhỏ hơn số này");
        }
        o.getLines().clear();
        orders.flush();
        apply(o, req, customer, totals, actor);
        orders.saveAndFlush(o);
        if (paid.signum() > 0) {
            deposits.receive(o, customer, paid, req.paymentMethod(), req.bankAccountId(), actor);
        }
        return o;
    }

    @Transactional
    public CustomerOrder confirm(UUID id, Actor actor) {
        CustomerOrder o = openForUpdate(id, actor);
        rules.checkNotLocked(o.getBranchId(), o.getOrderedAt());
        o.setStatus("CONFIRMED");
        return o;
    }

    /** Hủy đơn: tiền cọc (nếu có) hoàn lại khách bằng phiếu chi PC{mã đơn} ngay lúc hủy. */
    @Transactional
    public CustomerOrder cancel(UUID id, String refundMethod, Actor actor) {
        CustomerOrder o = openForUpdate(id, actor);
        rules.checkNotLocked(o.getBranchId(), Instant.now());
        deposits.refund(o, refundMethod, actor);
        o.setStatus("CANCELLED");
        o.setCancelledAt(Instant.now());
        return o;
    }

    private CustomerOrder openForUpdate(UUID id, Actor actor) {
        CustomerOrder o = orders.findForUpdate(id)
                .orElseThrow(() -> BusinessException.notFound("ORDER_NOT_FOUND", "Không tìm thấy đơn đặt hàng"));
        actor.checkBranch(o.getBranchId());
        if (!o.isOpen()) {
            throw BusinessException.badRequest("ORDER_NOT_OPEN", "COMPLETED".equals(o.getStatus())
                    ? "Đơn " + o.getCode() + " đã tạo hóa đơn — hủy hóa đơn trước nếu cần sửa / hủy đơn"
                    : "Đơn " + o.getCode() + " đã hủy");
        }
        return o;
    }

    private Customer customer(UUID id) {
        return customers.findById(id)
                .orElseThrow(() -> BusinessException.badRequest("CUSTOMER_NOT_FOUND", "Khách hàng không tồn tại"));
    }

    /** Tiền khách trả thêm lần này, tối đa phần còn lại của đơn. */
    private static BigDecimal paidNow(OrderRequest req, InvoiceMath.Totals totals, BigDecimal deposit) {
        BigDecimal paid = req.paidAmount() == null ? BigDecimal.ZERO : InvoiceMath.money(req.paidAmount());
        return paid.min(totals.total().subtract(deposit).max(BigDecimal.ZERO));
    }

    private static void apply(CustomerOrder o, OrderRequest req, Customer customer, InvoiceMath.Totals totals, Actor actor) {
        o.setCustomerId(customer.getId());
        o.setCustomerName(customer.getName());
        o.setSellerId(req.sellerId() == null ? actor.id() : req.sellerId());
        o.setSellerName(req.sellerId() == null ? actor.name() : req.sellerName());
        o.setSubtotal(totals.subtotal());
        o.setDiscount(totals.discount());
        o.setTotal(totals.total());
        o.setNote(req.note());
        for (int i = 0; i < req.lines().size(); i++) {
            LineInput in = req.lines().get(i);
            var line = new CustomerOrderLine();
            line.setId(UUID.randomUUID());
            line.setOrder(o);
            line.setLineNo(i + 1);
            line.setProductId(in.productId());
            line.setUnitId(in.unitId());
            line.setProductCode(in.productCode());
            line.setProductName(in.productName());
            line.setUnitName(in.unitName());
            line.setQuantity(in.quantity());
            line.setUnitPrice(in.unitPrice());
            line.setDiscount(in.discount() == null ? BigDecimal.ZERO : in.discount());
            line.setNote(in.note());
            line.setTaxCode(in.taxCode());
            o.getLines().add(line);
        }
    }
}
