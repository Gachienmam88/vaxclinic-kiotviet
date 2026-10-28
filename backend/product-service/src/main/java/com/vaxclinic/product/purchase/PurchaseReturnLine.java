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
import java.util.UUID;

@Entity
@Table(name = "purchase_return_lines")
@Getter
@Setter
@NoArgsConstructor
public class PurchaseReturnLine {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "return_id")
    private PurchaseReturn purchaseReturn;

    @Column(name = "line_no", nullable = false)
    private int lineNo;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "unit_id", nullable = false)
    private UUID unitId;

    @Column(name = "conversion_rate", nullable = false)
    private BigDecimal conversionRate;

    @Column(nullable = false)
    private BigDecimal quantity;

    /** Giá trả / 1 đơn vị (chưa VAT). */
    @Column(name = "unit_price", nullable = false)
    private BigDecimal unitPrice;

    @Column(name = "lot_number")
    private String lotNumber;
}
