package com.vaxclinic.sales.invoice;

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
import org.springframework.data.domain.Persistable;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Hóa đơn bán hàng. id do máy bán hàng sinh (đồng bộ offline gửi lại cùng id → không tạo trùng).
 * Implements Persistable so a client-assigned id is INSERTed (persist), not merged into a detached copy.
 */
@Entity
@Table(name = "invoices")
@Getter
@Setter
@NoArgsConstructor
public class Invoice implements Persistable<UUID> {

    @Id
    private UUID id;
    @Column(nullable = false, unique = true)
    private String code;
    @Column(name = "branch_id", nullable = false)
    private UUID branchId;
    @Column(name = "customer_id")
    private UUID customerId;
    @Column(name = "customer_name")
    private String customerName;
    @Column(name = "seller_id")
    private UUID sellerId;
    @Column(name = "seller_name")
    private String sellerName;
    @Column(name = "created_by", nullable = false)
    private UUID createdBy;
    @Column(name = "created_by_name", nullable = false)
    private String createdByName;
    @Column(name = "sold_at", nullable = false)
    private Instant soldAt;
    @Column(nullable = false)
    private String status = "COMPLETED";
    @Column(name = "sale_mode", nullable = false)
    private String saleMode = "QUICK";
    @Column(nullable = false)
    private BigDecimal subtotal;
    @Column(nullable = false)
    private BigDecimal discount = BigDecimal.ZERO;
    @Column(nullable = false)
    private BigDecimal total;
    @Column(nullable = false)
    private BigDecimal paid = BigDecimal.ZERO;
    @Column(name = "payment_method")
    private String paymentMethod;
    private String note;
    @Column(nullable = false)
    private boolean offline;
    @Column(name = "cancelled_at")
    private Instant cancelledAt;
    /** Tăng mỗi lần sửa; client gửi kèm để không sửa đè bản người khác vừa sửa. */
    @Column(nullable = false)
    private int revision;
    /** Chứng từ kho hiện hành ở product-service (lần đầu = id hóa đơn; mỗi lần sửa đổi sang id mới). */
    @Column(name = "stock_doc_id", nullable = false)
    private UUID stockDocId;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("lineNo ASC")
    private List<InvoiceLine> lines = new ArrayList<>();

    @jakarta.persistence.Transient
    private boolean isNew = true;

    @Override
    public boolean isNew() {
        return isNew;
    }

    @jakarta.persistence.PostLoad
    @jakarta.persistence.PostPersist
    void markNotNew() {
        this.isNew = false;
    }
}
