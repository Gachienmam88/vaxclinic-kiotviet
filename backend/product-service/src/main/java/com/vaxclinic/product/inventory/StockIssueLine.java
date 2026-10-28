package com.vaxclinic.product.inventory;

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

@Entity
@Table(name = "stock_issue_lines")
@Getter
@Setter
@NoArgsConstructor
public class StockIssueLine {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "issue_id")
    private StockIssue issue;

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

    /** Giá vốn / 1 đơn vị đã chọn (= giá vốn cơ bản × quy đổi), chụp lại lúc lưu / hoàn thành. */
    @Column(name = "unit_cost", nullable = false)
    private BigDecimal unitCost = BigDecimal.ZERO;

    @Column(name = "lot_number")
    private String lotNumber;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;
}
