package com.vaxclinic.product.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/** Tỷ lệ tính thuế bán ra (seed trong migration, chỉ đọc). vatRate null = KCT/KKKNT. */
@Entity
@Table(name = "tax_rates")
@Getter
@NoArgsConstructor
public class TaxRate {

    @Id
    private UUID id;

    private String code;

    private String name;

    @Column(name = "vat_rate")
    private BigDecimal vatRate;

    @Column(name = "sort_order")
    private int sortOrder;
}
