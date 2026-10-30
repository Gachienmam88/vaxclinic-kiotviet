package com.vaxclinic.product.purchase;

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

/** Phiếu trả hàng cho nhà cung cấp; theo 1 phiếu nhập (receiptId) hoặc trả nhanh. */
@Entity
@Table(name = "purchase_returns")
@Getter
@Setter
@NoArgsConstructor
public class PurchaseReturn {

    @Id
    private UUID id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @Column(name = "supplier_id")
    private UUID supplierId;

    @Column(name = "receipt_id")
    private UUID receiptId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DocStatus status = DocStatus.DRAFT;

    @Column(name = "returned_at", nullable = false)
    private Instant returnedAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "created_by_name", nullable = false, updatable = false)
    private String createdByName;

    @Column(name = "returner_id")
    private UUID returnerId;

    @Column(name = "returner_name")
    private String returnerName;

    @Column(nullable = false)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal discount = BigDecimal.ZERO;

    @Column(name = "vat_rate")
    private BigDecimal vatRate;

    @Column(name = "vat_mode", nullable = false)
    private String vatMode = PurchaseMath.MODE_LINE;

    /** Hình thức NCC hoàn tiền: CASH / TRANSFER (null = tiền mặt). */
    @Column(name = "payment_method")
    private String paymentMethod;

    @Column(name = "vat_amount", nullable = false)
    private BigDecimal vatAmount = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal total = BigDecimal.ZERO;

    @Column(name = "refund_amount", nullable = false)
    private BigDecimal refundAmount = BigDecimal.ZERO;

    private String note;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @OneToMany(mappedBy = "purchaseReturn", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("lineNo ASC")
    private List<PurchaseReturnLine> lines = new ArrayList<>();
}
