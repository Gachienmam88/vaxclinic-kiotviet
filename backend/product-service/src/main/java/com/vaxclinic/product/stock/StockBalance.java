package com.vaxclinic.product.stock;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.UUID;

/** Tồn kho của 1 hàng tại 1 điểm tiêm (đơn vị cơ bản). */
@Entity
@Table(name = "stock_balances")
@Getter
@Setter
@NoArgsConstructor
public class StockBalance {

    @Embeddable
    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        @Column(name = "product_id")
        private UUID productId;
        @Column(name = "branch_id")
        private UUID branchId;
    }

    @EmbeddedId
    private Key id;

    @Column(nullable = false)
    private BigDecimal quantity = BigDecimal.ZERO;

    /** Số lượng khách đã đặt (giữ hàng). */
    @Column(nullable = false)
    private BigDecimal reserved = BigDecimal.ZERO;

    public StockBalance(UUID productId, UUID branchId) {
        this.id = new Key(productId, branchId);
    }
}
