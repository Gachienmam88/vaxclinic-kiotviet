package com.vaxclinic.product.inventory;

import com.vaxclinic.product.purchase.DocStatus;
import com.vaxclinic.product.stock.StockLedgerEntry.DocType;
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

/** Phiếu xuất kho không bán: xuất hủy (XH) hoặc xuất dùng nội bộ (XNB). Trừ kho theo giá vốn khi hoàn thành. */
@Entity
@Table(name = "stock_issues")
@Getter
@Setter
@NoArgsConstructor
public class StockIssue {

    /** prefix: tiền tố mã phiếu; out/cancel: loại dòng thẻ kho khi hoàn thành / khi hủy phiếu đã hoàn thành. */
    public enum Type {
        DAMAGE("XH", "Xuất hủy", DocType.DAMAGE, DocType.DAMAGE_CANCEL),
        INTERNAL("XNB", "Xuất dùng nội bộ", DocType.INTERNAL_USE, DocType.INTERNAL_USE_CANCEL);

        public final String prefix;
        public final String label;
        public final DocType out;
        public final DocType cancel;

        Type(String prefix, String label, DocType out, DocType cancel) {
            this.prefix = prefix;
            this.label = label;
            this.out = out;
            this.cancel = cancel;
        }
    }

    @Id
    private UUID id;

    @Column(nullable = false, unique = true)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false)
    private Type type;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DocStatus status = DocStatus.DRAFT;

    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "created_by_name", nullable = false, updatable = false)
    private String createdByName;

    private String reason;

    private String note;

    @Column(name = "total_qty", nullable = false)
    private BigDecimal totalQty = BigDecimal.ZERO;

    @Column(name = "total_value", nullable = false)
    private BigDecimal totalValue = BigDecimal.ZERO;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @OneToMany(mappedBy = "issue", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("lineNo ASC")
    private List<StockIssueLine> lines = new ArrayList<>();
}
