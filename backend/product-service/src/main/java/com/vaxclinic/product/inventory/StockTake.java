package com.vaxclinic.product.inventory;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Phiếu kiểm kho (KK) tại 1 chi nhánh: Phiếu tạm → Đã cân bằng kho; chỉ phiếu tạm mới hủy được. */
@Entity
@Table(name = "stock_takes")
@Getter
@Setter
@NoArgsConstructor
public class StockTake {

    public enum Status { DRAFT, BALANCED, CANCELLED }

    @Id
    private UUID id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.DRAFT;

    @Column(name = "taken_at", nullable = false)
    private Instant takenAt;

    @Column(name = "balanced_at")
    private Instant balancedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "created_by_name", nullable = false, updatable = false)
    private String createdByName;

    private String note;

    @Column(name = "actual_qty", nullable = false)
    private BigDecimal actualQty = BigDecimal.ZERO;

    @Column(name = "actual_value", nullable = false)
    private BigDecimal actualValue = BigDecimal.ZERO;

    @Column(name = "diff_value", nullable = false)
    private BigDecimal diffValue = BigDecimal.ZERO;

    @Column(name = "increase_qty", nullable = false)
    private BigDecimal increaseQty = BigDecimal.ZERO;

    @Column(name = "decrease_qty", nullable = false)
    private BigDecimal decreaseQty = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @OneToMany(mappedBy = "stockTake", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("lineNo ASC")
    private List<StockTakeLine> lines = new ArrayList<>();
}
