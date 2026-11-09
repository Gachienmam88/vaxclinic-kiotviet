package com.vaxclinic.product.stock.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/** Tồn theo lô / hạn sử dụng tại 1 điểm tiêm (chỉ cho hàng quản lý theo lô). */
@Entity
@Table(name = "product_lots")
@Getter
@Setter
@NoArgsConstructor
public class ProductLot {

    @Id
    private UUID id;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @Column(name = "lot_number", nullable = false)
    private String lotNumber;

    @Column(name = "expiry_date", nullable = false)
    private LocalDate expiryDate;

    @Column(nullable = false)
    private BigDecimal quantity = BigDecimal.ZERO;
}
