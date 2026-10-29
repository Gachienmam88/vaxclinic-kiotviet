package com.vaxclinic.sales.delivery;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.delivery.ShipmentDtos.DeliveryInput;
import com.vaxclinic.sales.delivery.ShipmentDtos.ReturnOptions;
import com.vaxclinic.sales.delivery.ShipmentDtos.ShipmentInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * "Trạng thái giao hàng" chọn ở màn bán hàng (Tự giao hàng): vận đơn luôn tạo ở Chờ xử lý cùng hóa đơn, sau khi hóa đơn
 * đã lưu thì chuyển sang trạng thái đã chọn qua {@link ShipmentStatusService} (ghi sổ đối tác / công nợ như cập nhật tay).
 * Chuyển không được (VD khóa sổ) → giữ Chờ xử lý, hóa đơn vẫn lưu; người dùng cập nhật lại ở Quản lý giao hàng.
 */
@Service
public class ShipmentInitialStatus {

    private static final Logger log = LoggerFactory.getLogger(ShipmentInitialStatus.class);
    private static final ReturnOptions NONE = new ReturnOptions(null, null, null, null);

    private final ShipmentInvoiceHooks hooks;
    private final ShipmentStatusService status;

    public ShipmentInitialStatus(ShipmentInvoiceHooks hooks, ShipmentStatusService status) {
        this.hooks = hooks;
        this.status = status;
    }

    public void apply(UUID invoiceId, DeliveryInput d, Actor actor) {
        if (d == null || d.status() == null || ShipmentStatus.PENDING.equals(d.status())) {
            return;
        }
        ShipmentInfo s = hooks.info(invoiceId);
        if (s == null || !ShipmentStatus.beforePickup(s.status()) || s.status().equals(d.status())
                || !ShipmentStatus.canMove(s.status(), d.status())) {
            return;
        }
        try {
            status.change(s.id(), d.status(), "Trạng thái chọn khi bán hàng", NONE, actor);
        } catch (BusinessException e) {
            log.warn("Không chuyển được vận đơn {} sang {}: {}", s.code(), d.status(), e.getMessage());
        }
    }
}
