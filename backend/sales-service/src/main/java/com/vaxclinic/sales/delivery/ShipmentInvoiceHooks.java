package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.ShipmentDtos.DeliveryInput;
import com.vaxclinic.sales.delivery.ShipmentDtos.ShipmentInfo;
import com.vaxclinic.sales.invoice.Invoice;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Vận đơn gắn với hóa đơn "Bán giao hàng": kiểm tra trước khi xuất kho, tạo / cập nhật trong transaction của hóa đơn,
 * chặn sửa / hủy hóa đơn khi đã lấy hàng, hủy vận đơn khi hủy hóa đơn. Thu hộ = khách cần trả − đã trả.
 * 1 hóa đơn có thể có nhiều vận đơn (vận đơn cũ đã hủy) nhưng chỉ 1 vận đơn đang hoạt động (chưa hủy) — mọi thao tác
 * theo hóa đơn chỉ nhìn vận đơn đang hoạt động.
 */
@Component
public class ShipmentInvoiceHooks {

    private final ShipmentRepository shipments;
    private final ShipmentInvoiceRepository byInvoice;
    private final DeliveryPartnerRepository partners;

    public ShipmentInvoiceHooks(ShipmentRepository shipments, ShipmentInvoiceRepository byInvoice,
                                DeliveryPartnerRepository partners) {
        this.shipments = shipments;
        this.byInvoice = byInvoice;
        this.partners = partners;
    }

    /** Gọi TRƯỚC khi xuất kho: Bán giao hàng phải có thông tin giao + đối tác đang hoạt động. */
    public void validate(String saleMode, DeliveryInput d) {
        if (d == null) {
            if ("DELIVERY".equals(saleMode)) {
                throw BusinessException.badRequest("DELIVERY_REQUIRED", "Bán giao hàng: chưa nhập thông tin giao hàng");
            }
            return;
        }
        if (!"DELIVERY".equals(saleMode)) {
            throw BusinessException.badRequest("DELIVERY_MODE", "Thông tin giao hàng chỉ dùng cho chế độ Bán giao hàng");
        }
        Boolean active = partners.activeOf(d.partnerId());
        if (!Boolean.TRUE.equals(active)) {
            throw BusinessException.badRequest("PARTNER_NOT_FOUND", "Đối tác giao hàng không tồn tại hoặc đã ngừng hoạt động");
        }
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public UUID createForInvoice(Invoice inv, DeliveryInput d, Actor actor) {
        if (d == null) {
            return null;
        }
        UUID id = UUID.randomUUID();
        String code = "VD%06d".formatted(shipments.nextCodeNumber());
        shipments.insert(id, code, inv.getId(), inv.getBranchId(), d, money(d.shippingFee()), feePayer(d), cod(inv), actor.id(),
                actor.name());
        log(id, null, ShipmentStatus.PENDING, "Tạo vận đơn từ hóa đơn " + inv.getCode(), actor);
        return id;
    }

    /** Sửa / hủy hóa đơn: chỉ khi vận đơn đang hoạt động chưa lấy hàng (hoặc không còn vận đơn hoạt động). */
    public void checkNotPickedUp(UUID invoiceId, String action) {
        String status = statusOf(invoiceId);
        if (status != null && !ShipmentStatus.beforePickup(status)) {
            throw BusinessException.badRequest("SHIPMENT_IN_PROGRESS",
                    "Vận đơn đang ở trạng thái " + ShipmentStatus.label(status) + ", không " + action + " được hóa đơn");
        }
    }

    /** Sau khi ghi bản sửa hóa đơn: cập nhật thông tin giao + thu hộ theo tổng / đã trả mới (thêm vận đơn nếu chưa có vận đơn hoạt động). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void syncOnEdit(Invoice inv, DeliveryInput d, Actor actor) {
        String status = statusOf(inv.getId());
        if (status == null) {
            createForInvoice(inv, d, actor);
            return;
        }
        if (!ShipmentStatus.beforePickup(status)) {
            return;
        }
        if (d == null) {
            byInvoice.updateCod(inv.getId(), cod(inv));
            return;
        }
        byInvoice.updateDelivery(inv.getId(), d, money(d.shippingFee()), feePayer(d), cod(inv));
    }

    /** Trong transaction hủy hóa đơn: vận đơn đang hoạt động chưa lấy hàng → Đã hủy (ghi lịch sử). */
    @Transactional(propagation = Propagation.MANDATORY)
    public void onInvoiceCancelled(Invoice inv, Actor actor) {
        List<Map<String, Object>> rows = byInvoice.lockActive(inv.getId());
        if (rows.isEmpty() || !ShipmentStatus.beforePickup((String) rows.get(0).get("status"))) {
            return;
        }
        UUID id = (UUID) rows.get(0).get("id");
        markCancelled(id);
        log(id, (String) rows.get(0).get("status"), ShipmentStatus.CANCELLED, "Hủy hóa đơn " + inv.getCode(), actor);
    }

    /** Vận đơn → Đã hủy: bỏ khoản thu hộ (chưa lấy hàng nên chưa ghi sổ đối tác). */
    void markCancelled(UUID shipmentId) {
        shipments.markCancelled(shipmentId);
    }

    /** Vận đơn đang hoạt động của hóa đơn; không có thì vận đơn đã hủy gần nhất (chi tiết hóa đơn hiện "Chưa giao"). */
    public ShipmentInfo info(UUID invoiceId) {
        return byInvoice.info(invoiceId);
    }

    /** Ghi lịch sử đổi trạng thái (thời gian + người thao tác). */
    public void log(UUID shipmentId, String from, String to, String note, Actor actor) {
        shipments.insertLog(shipmentId, from, to, note, actor.id(), actor.name());
    }

    /** Trạng thái vận đơn đang hoạt động (null = không có). */
    public String statusOf(UUID invoiceId) {
        return byInvoice.activeStatus(invoiceId);
    }

    private static BigDecimal cod(Invoice inv) {
        return inv.getTotal().subtract(inv.getPaid()).max(BigDecimal.ZERO);
    }

    private static String feePayer(DeliveryInput d) {
        return d.feePayer() == null ? "SHOP" : d.feePayer();
    }

    static BigDecimal money(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v.setScale(0, RoundingMode.HALF_UP);
    }
}
