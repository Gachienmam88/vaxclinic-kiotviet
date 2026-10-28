package com.vaxclinic.sales.invoice;

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

/** Dòng hóa đơn. Tên/mã/đơn vị chụp lại lúc bán; cost + lots do product-service trả về khi trừ kho. */
@Entity
@Table(name = "invoice_lines")
@Getter
@Setter
@NoArgsConstructor
public class InvoiceLine {

    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invoice_id")
    private Invoice invoice;
    @Column(name = "line_no", nullable = false)
    private int lineNo;
    @Column(name = "product_id", nullable = false)
    private UUID productId;
    @Column(name = "unit_id", nullable = false)
    private UUID unitId;
    @Column(name = "product_code", nullable = false)
    private String productCode;
    @Column(name = "product_name", nullable = false)
    private String productName;
    @Column(name = "unit_name", nullable = false)
    private String unitName;
    @Column(nullable = false)
    private BigDecimal quantity;
    @Column(name = "unit_price", nullable = false)
    private BigDecimal unitPrice;
    @Column(nullable = false)
    private BigDecimal discount = BigDecimal.ZERO;
    @Column(nullable = false)
    private BigDecimal cost = BigDecimal.ZERO;
    private String lots;
    private String note;
    @Column(name = "tax_code")
    private String taxCode;
}
