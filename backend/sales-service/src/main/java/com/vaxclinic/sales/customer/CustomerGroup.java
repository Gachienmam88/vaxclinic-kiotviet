package com.vaxclinic.sales.customer;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Nhóm khách hàng. Giảm giá nhóm (PERCENT / AMOUNT) được màn bán hàng tự điền vào giảm giá hóa đơn. */
@Entity
@Table(name = "customer_groups")
@Getter
@Setter
@NoArgsConstructor
public class CustomerGroup {

    @Id
    private UUID id;
    @Column(nullable = false)
    private String name;
    @Column(name = "discount_type", nullable = false)
    private String discountType = "PERCENT";
    @Column(name = "discount_value", nullable = false)
    private BigDecimal discountValue = BigDecimal.ZERO;
    private String note;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
