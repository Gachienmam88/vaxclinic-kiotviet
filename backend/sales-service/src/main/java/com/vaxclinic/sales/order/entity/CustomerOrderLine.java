package com.vaxclinic.sales.order.entity;

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

/** Dòng đơn đặt hàng — chụp lại mã/tên/đơn vị/giá lúc đặt; không gắn lô (chưa xuất kho). */
@Entity
@Table(name = "customer_order_lines")
@Getter
@Setter
@NoArgsConstructor
public class CustomerOrderLine {

    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id")
    private CustomerOrder order;
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
    private String note;
    @Column(name = "tax_code")
    private String taxCode;
}
