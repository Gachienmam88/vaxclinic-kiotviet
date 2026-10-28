package com.vaxclinic.product.purchase;

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

/** Dòng phiếu nhập: 1 hàng × 1 đơn vị × (1 lô nếu hàng quản lý lô). Số lượng / giá theo đơn vị đã chọn. */
@Entity
@Table(name = "purchase_receipt_lines")
@Getter
@Setter
@NoArgsConstructor
public class PurchaseReceiptLine {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "receipt_id")
    private PurchaseReceipt receipt;

    @Column(name = "line_no", nullable = false)
    private int lineNo;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "unit_id", nullable = false)
    private UUID unitId;

    /** Chụp lại quy đổi lúc nhập để sửa đơn vị sau này không làm sai phiếu cũ. */
    @Column(name = "conversion_rate", nullable = false)
    private BigDecimal conversionRate;

    @Column(nullable = false)
    private BigDecimal quantity;

    @Column(name = "unit_price", nullable = false)
    private BigDecimal unitPrice;

    @Column(nullable = false)
    private BigDecimal discount = BigDecimal.ZERO;

    @Column(name = "lot_number")
    private String lotNumber;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;
}
