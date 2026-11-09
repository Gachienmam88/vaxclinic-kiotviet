package com.vaxclinic.product.product.entity;

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

/** Đơn vị tính của hàng hóa; mỗi đơn vị là 1 mã hàng bán được (VD: Hộp, Liều). */
@Entity
@Table(name = "product_units")
@Getter
@Setter
@NoArgsConstructor
public class ProductUnit {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(nullable = false, unique = true)
    private String code;

    private String barcode;

    @Column(name = "unit_name", nullable = false)
    private String unitName;

    /** Số đơn vị cơ bản trong 1 đơn vị này (đơn vị cơ bản = 1). */
    @Column(name = "conversion_rate", nullable = false)
    private BigDecimal conversionRate = BigDecimal.ONE;

    @Column(nullable = false)
    private BigDecimal price = BigDecimal.ZERO;

    @Column(name = "is_base", nullable = false)
    private boolean base;

    @Column(name = "direct_sale", nullable = false)
    private boolean directSale = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}
