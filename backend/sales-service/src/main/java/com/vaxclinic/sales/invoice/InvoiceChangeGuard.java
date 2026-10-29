package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.cashbook.CashVoucherRepository;
import com.vaxclinic.sales.channel.SalesChannels;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.common.SalesRules;
import com.vaxclinic.sales.customer.Customer;
import com.vaxclinic.sales.delivery.ShipmentInvoiceHooks;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceRequest;
import com.vaxclinic.sales.order.OrderDepositLedger;
import com.vaxclinic.sales.salesreturn.SalesReturnRepository;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;

/**
 * Kiểm tra TRƯỚC khi sửa / hủy hóa đơn (trước mọi thao tác kho) — tách khỏi {@link InvoiceService}, giữ nguyên thứ tự kiểm tra:
 * trạng thái, revision, phiếu trả, chi nhánh, khóa sổ, HĐĐT, vận đơn, kênh bán; phiếu thu nợ / thu thêm / tiền cọc.
 */
@Component
public class InvoiceChangeGuard {

    private final CashVoucherRepository vouchers;
    private final SalesReturnRepository returns;
    private final SalesRules rules;
    private final ShipmentInvoiceHooks shipments;
    private final SalesChannels channels;
    private final InvoiceExtraPayments extraPayments;
    private final OrderDepositLedger orderDeposits;

    public InvoiceChangeGuard(CashVoucherRepository vouchers, SalesReturnRepository returns, SalesRules rules,
                              ShipmentInvoiceHooks shipments, SalesChannels channels, InvoiceExtraPayments extraPayments,
                              OrderDepositLedger orderDeposits) {
        this.vouchers = vouchers;
        this.returns = returns;
        this.rules = rules;
        this.shipments = shipments;
        this.channels = channels;
        this.extraPayments = extraPayments;
        this.orderDeposits = orderDeposits;
    }

    /** Sửa hóa đơn, bước 1 (trước khi tra khách hàng): hóa đơn còn sửa được. */
    public void checkEditable(Invoice inv, int expectedRevision, InvoiceRequest req, Actor actor) {
        UUID id = inv.getId();
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
        rules.checkNotLocked(inv.getBranchId(), inv.getSoldAt());
        rules.checkEInvoiceNotPublished(id, "chỉnh sửa");
        shipments.checkNotPickedUp(id, "sửa");
        if (req.delivery() != null) shipments.validate(req.saleMode(), req.delivery());
        channels.resolve(req.salesChannel(), inv.getSalesChannel());
    }

    /**
     * Sửa hóa đơn, bước 2: kiểm tra số khách trả mới với phiếu thu thêm / phiếu thu nợ / tiền cọc;
     * trả về phần của phiếu TT{mã} (paid trừ các phiếu thu thêm giữ nguyên).
     */
    public BigDecimal autoReceiptAmount(Invoice inv, InvoiceRequest req, Customer customer, InvoiceMath.Totals totals,
                                        BigDecimal paid) {
        UUID id = inv.getId();
        boolean delivery = req.delivery() != null || "DELIVERY".equals(inv.getSaleMode());
        if (customer == null && paid.compareTo(totals.total()) < 0 && !delivery) {
            throw BusinessException.badRequest("WALK_IN_DEBT", "Khách lẻ phải thanh toán đủ — chọn khách hàng để ghi nợ");
        }
        // Thanh toán nhiều phương thức: phiếu thu thêm giữ nguyên; paidAmount = tổng khách đã trả → TT{mã} = phần còn lại
        BigDecimal extras = extraPayments.activeTotal(id);
        if (extras.signum() > 0) {
            if (paid.compareTo(extras) < 0) {
                throw BusinessException.badRequest("INVOICE_EXTRA_PAYMENTS", "Hóa đơn thanh toán nhiều phương thức: số tiền "
                        + "khách đã trả không được nhỏ hơn " + Actor.money(extras) + " (các phương thức thanh toán thêm)");
            }
            if (!Objects.equals(inv.getCustomerId(), req.customerId())) {
                throw BusinessException.badRequest("INVOICE_EXTRA_PAYMENTS",
                        "Hóa đơn thanh toán nhiều phương thức: không đổi khách hàng được");
            }
            paid = paid.subtract(extras);
        }
        BigDecimal debtPayments = inv.getPaid().subtract(autoPaid(id)).subtract(extras); // phiếu thu nợ (PT) + tiền cọc đơn đặt hàng
        if (debtPayments.signum() > 0 && (!Objects.equals(inv.getCustomerId(), req.customerId())
                || totals.total().compareTo(debtPayments.add(extras).add(paid)) < 0)) {
            throw BusinessException.badRequest("INVOICE_HAS_PAYMENTS",
                    "Hóa đơn đã có phiếu thu nợ " + debtPayments + "đ: không đổi khách / không giảm tổng dưới số đã thu");
        }
        return paid;
    }

    /** Hủy hóa đơn (hóa đơn chưa hủy): còn phiếu thu nợ / phiếu trả hàng thì không cho hủy. */
    public void checkCancellable(Invoice inv, Actor actor) {
        UUID id = inv.getId();
        actor.checkBranch(inv.getBranchId());
        rules.checkNotLocked(inv.getBranchId(), inv.getSoldAt());
        rules.checkEInvoiceNotPublished(id, "hủy");
        shipments.checkNotPickedUp(id, "hủy");
        if (inv.getPaid().compareTo(autoPaid(id).add(extraPayments.activeTotal(id)).add(orderDeposits.allocatedTo(id))) > 0) { // tiền cọc đơn gỡ ra khi hủy
            throw BusinessException.badRequest("INVOICE_HAS_PAYMENTS",
                    "Hóa đơn đã có phiếu thu nợ phân bổ, hãy hủy các phiếu thu đó trước");
        }
        if (hasReturns(id)) {
            throw BusinessException.badRequest("INVOICE_HAS_RETURNS", "Hóa đơn đã có phiếu trả hàng, hãy hủy phiếu trả trước");
        }
    }

    private BigDecimal autoPaid(UUID invoiceId) {
        return vouchers.findBySourceTypeAndSourceId("INVOICE", invoiceId)
                .filter(v -> "PAID".equals(v.getStatus())).map(v -> v.getAmount()).orElse(BigDecimal.ZERO);
    }

    private boolean hasReturns(UUID invoiceId) {
        Integer n = returns.countCompletedByInvoice(invoiceId);
        return n != null && n > 0;
    }
}
