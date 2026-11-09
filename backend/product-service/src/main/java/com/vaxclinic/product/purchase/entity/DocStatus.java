package com.vaxclinic.product.purchase.entity;

/** Trạng thái chứng từ mua hàng: Phiếu tạm → Hoàn thành (vào/ra kho) → (có thể) Đã hủy. */
public enum DocStatus {
    DRAFT, COMPLETED, CANCELLED
}
