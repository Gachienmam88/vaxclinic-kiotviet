package com.vaxclinic.product.purchase;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.product.Product;
import com.vaxclinic.product.product.ProductRepository;
import com.vaxclinic.product.product.ProductUnit;
import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** Kiểm tra dùng chung cho chứng từ mua hàng: quyền điểm tiêm, NCC, hàng hóa + đơn vị hợp lệ. */
@Component
public class PurchaseLineSupport {

    private final ProductRepository products;
    private final SupplierRepository suppliers;
    private final com.vaxclinic.common.settings.ShopSettingsClient settings;

    public PurchaseLineSupport(ProductRepository products, SupplierRepository suppliers,
                               com.vaxclinic.common.settings.ShopSettingsClient settings) {
        this.products = products;
        this.suppliers = suppliers;
        this.settings = settings;
    }

    /** Khóa sổ (Thiết lập → Khóa sổ): chứng từ thuộc kỳ đã khóa không được tạo / sửa / hủy. */
    public void checkNotLocked(UUID branchId, java.time.Instant documentTime) {
        settings.get().checkNotLocked(branchId, documentTime);
    }

    public void checkBranch(Actor actor, UUID branchId) {
        if (!actor.branchIds().contains(branchId.toString())) {
            throw BusinessException.badRequest("BRANCH_NOT_ALLOWED", "Bạn không làm việc tại chi nhánh này");
        }
    }

    public Supplier supplierOrNull(UUID supplierId) {
        if (supplierId == null) {
            return null;
        }
        return suppliers.findById(supplierId)
                .orElseThrow(() -> BusinessException.badRequest("SUPPLIER_NOT_FOUND", "Nhà cung cấp không tồn tại"));
    }

    /** Cache sản phẩm trong 1 request để không query lặp khi phiếu có nhiều dòng cùng hàng. */
    public Map<UUID, Product> newCache() {
        return new HashMap<>();
    }

    public Product product(Map<UUID, Product> cache, UUID productId) {
        return cache.computeIfAbsent(productId, id -> products.findById(id).filter(p -> !p.isDeleted())
                .orElseThrow(() -> BusinessException.badRequest("PRODUCT_NOT_FOUND", "Hàng hóa không tồn tại")));
    }

    public ProductUnit unit(Product p, UUID unitId) {
        return p.getUnits().stream().filter(u -> u.getId().equals(unitId)).findFirst()
                .orElseThrow(() -> BusinessException.badRequest("UNIT_NOT_FOUND",
                        "Đơn vị tính không thuộc hàng " + p.getName()));
    }

    public static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
