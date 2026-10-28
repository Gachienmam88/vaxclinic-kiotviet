package com.vaxclinic.product.internal;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.product.Product;
import com.vaxclinic.product.stock.ProductLotRepository;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * Hạn sử dụng cho dòng khách trả hàng (SALE_RETURN) theo lô:
 * - lô đã có tại chi nhánh → dùng lại lô, hạn gửi lên (nếu có) phải trùng hạn của lô, lệch → 400 LOT_EXPIRY_MISMATCH;
 * - lô chưa có → hạn gửi lên (trả nhanh nhập lô mới); null → StockMovementService báo EXPIRY_REQUIRED.
 * Hạn đã qua vẫn nhận (hàng trả hết hạn thường được xuất hủy sau đó).
 */
@Component
public class SaleReturnLotExpiryResolver {

    private static final DateTimeFormatter DMY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final ProductLotRepository lots;

    public SaleReturnLotExpiryResolver(ProductLotRepository lots) {
        this.lots = lots;
    }

    public LocalDate expiry(Product p, UUID branchId, String lotNumber, LocalDate requested) {
        var existing = lots.findByProductIdAndBranchIdAndLotNumber(p.getId(), branchId, lotNumber.trim());
        if (existing.isEmpty()) {
            return requested;
        }
        LocalDate lotExpiry = existing.get().getExpiryDate();
        if (requested != null && !requested.equals(lotExpiry)) {
            throw BusinessException.badRequest("LOT_EXPIRY_MISMATCH", p.getName() + ": lô " + lotNumber.trim()
                    + " đã có tại chi nhánh với hạn sử dụng " + lotExpiry.format(DMY)
                    + ", không khớp hạn đã nhập " + requested.format(DMY));
        }
        return lotExpiry;
    }
}
