package com.vaxclinic.product.product;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

/**
 * Hàng hóa gốc. Có 1 đơn vị cơ bản + các đơn vị quy đổi (mỗi đơn vị một mã hàng).
 * Tồn kho, giá vốn, định mức tồn đều tính theo đơn vị cơ bản.
 */
@Entity
@Table(name = "products")
@Getter
@Setter
@NoArgsConstructor
public class Product {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(name = "short_name")
    private String shortName;

    @Column(name = "einvoice_name")
    private String einvoiceName;

    @Column(name = "category_id", nullable = false)
    private UUID categoryId;

    @Column(name = "tax_rate_id")
    private UUID taxRateId;

    @Column(name = "tax_reduction", nullable = false)
    private boolean taxReduction;

    @Column(name = "lot_managed", nullable = false)
    private boolean lotManaged;

    @Column(nullable = false)
    private BigDecimal cost = BigDecimal.ZERO;

    @Column(name = "min_stock", nullable = false)
    private BigDecimal minStock = BigDecimal.ZERO;

    @Column(name = "max_stock", nullable = false)
    private BigDecimal maxStock = new BigDecimal("999999999");

    @Column(name = "position_id")
    private UUID positionId;

    private BigDecimal weight;

    @Column(name = "weight_unit", nullable = false)
    private String weightUnit = "g";

    private String description;

    private String note;

    @Column(name = "loyalty_points", nullable = false)
    private boolean loyaltyPoints = true;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false)
    private boolean deleted;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<ProductUnit> units = new ArrayList<>();

    public ProductUnit baseUnit() {
        return units.stream().filter(ProductUnit::isBase).findFirst()
                .orElseThrow(() -> new IllegalStateException("Product " + id + " has no base unit"));
    }
}
