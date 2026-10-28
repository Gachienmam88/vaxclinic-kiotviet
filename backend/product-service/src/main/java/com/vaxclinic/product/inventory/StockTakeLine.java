package com.vaxclinic.product.inventory;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** 1 dòng kiểm kho (đơn vị cơ bản): 1 hàng, hoặc 1 lô nếu hàng quản lý theo lô. actualQty null = chưa kiểm. */
@Entity
@Table(name = "stock_take_lines")
@Getter
@Setter
@NoArgsConstructor
public class StockTakeLine {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "take_id")
    private StockTake stockTake;

    @Column(name = "line_no", nullable = false)
    private int lineNo;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "lot_number")
    private String lotNumber;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(name = "system_qty", nullable = false)
    private BigDecimal systemQty = BigDecimal.ZERO;

    @Column(name = "actual_qty")
    private BigDecimal actualQty;

    @Column(nullable = false)
    private BigDecimal cost = BigDecimal.ZERO;

    /** Thực tế − tồn kho; dòng chưa kiểm = 0 (không cân bằng). */
    public BigDecimal diffQty() {
        return actualQty == null ? BigDecimal.ZERO : actualQty.subtract(systemQty);
    }
}
