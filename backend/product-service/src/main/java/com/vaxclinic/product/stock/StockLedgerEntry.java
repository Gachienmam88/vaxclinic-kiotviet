package com.vaxclinic.product.stock;

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

/**
 * 1 dòng thẻ kho — không xóa; sai thì ghi bút toán điều chỉnh. occurred_at = ngày của chứng từ (phiếu nhập / trả / xuất
 * lùi ngày thì dòng nằm đúng ngày đó, đổi ngày phiếu nhập thì dòng đổi theo); balance_after là giá trị dẫn xuất, được tính
 * lại cho các dòng sau khi chèn / dời dòng về quá khứ (StockMovementService). Thứ tự: (occurred_at, seq).
 */
@Entity
@Table(name = "stock_ledger")
@Getter
@Setter
@NoArgsConstructor
public class StockLedgerEntry {

    /** Loại giao dịch kho; tên hiển thị ở frontend. */
    public enum DocType {
        OPENING, PURCHASE, PURCHASE_CANCEL, PURCHASE_RETURN, PURCHASE_RETURN_CANCEL,
        SALE, SALE_CANCEL, SALE_RETURN, SALE_RETURN_CANCEL_OUT, ADJUSTMENT, TRANSFER_OUT, TRANSFER_IN, DAMAGE,
        DAMAGE_CANCEL, INTERNAL_USE, INTERNAL_USE_CANCEL;

        /** Giao dịch với NCC làm thay đổi giá vốn bình quân (nhập, hủy nhập, trả hàng nhập và hủy trả). */
        public boolean affectsCost() {
            return this == OPENING || this == PURCHASE || this == PURCHASE_CANCEL
                    || this == PURCHASE_RETURN || this == PURCHASE_RETURN_CANCEL;
        }
    }

    @Id
    private UUID id;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "branch_id", nullable = false)
    private UUID branchId;

    @Column(name = "lot_number")
    private String lotNumber;

    @Column(name = "doc_type", nullable = false)
    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    private DocType docType;

    @Column(name = "doc_id")
    private UUID docId;

    @Column(name = "doc_code")
    private String docCode;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt = Instant.now();

    @Column(nullable = false)
    private BigDecimal quantity;

    @Column(name = "unit_price", nullable = false)
    private BigDecimal unitPrice = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal cost = BigDecimal.ZERO;

    @Column(name = "balance_after", nullable = false)
    private BigDecimal balanceAfter;

    @Column(name = "partner_name")
    private String partnerName;

    @Column(name = "created_by")
    private UUID createdBy;

    /** Thứ tự ghi (DB sinh), phân định các dòng cùng occurred_at. */
    @Column(name = "seq", insertable = false, updatable = false)
    private Long seq;
}
