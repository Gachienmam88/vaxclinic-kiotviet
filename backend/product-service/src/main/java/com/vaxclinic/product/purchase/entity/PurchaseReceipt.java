package com.vaxclinic.product.purchase.entity;

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

/** Phiếu nhập hàng từ nhà cung cấp. Tiền đã làm tròn đồng; xem {@link PurchaseMath}. */
@Entity
@Table(name = "purchase_receipts")
@Getter
@Setter
@NoArgsConstructor
public class PurchaseReceipt {

    @Id
    private UUID id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @Column(name = "supplier_id")
    private UUID supplierId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DocStatus status = DocStatus.DRAFT;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "created_by_name", nullable = false, updatable = false)
    private String createdByName;

    @Column(name = "receiver_id")
    private UUID receiverId;

    @Column(name = "receiver_name")
    private String receiverName;

    @Column(name = "input_invoice_no")
    private String inputInvoiceNo;

    @Column(name = "vat_rate")
    private BigDecimal vatRate;

    @Column(nullable = false)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal discount = BigDecimal.ZERO;

    @Column(name = "vat_amount", nullable = false)
    private BigDecimal vatAmount = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal total = BigDecimal.ZERO;

    @Column(name = "paid_amount", nullable = false)
    private BigDecimal paidAmount = BigDecimal.ZERO;

    @Column(name = "payment_method")
    private String paymentMethod;

    private String note;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @OneToMany(mappedBy = "receipt", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("lineNo ASC")
    private List<PurchaseReceiptLine> lines = new ArrayList<>();
}
