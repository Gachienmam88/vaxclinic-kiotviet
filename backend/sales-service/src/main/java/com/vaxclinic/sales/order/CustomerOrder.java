package com.vaxclinic.sales.order;

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
 * Đơn đặt hàng (DH). Không trừ kho; deposit = tiền khách đã trả trước (phiếu thu Sổ quỹ nguồn ORDER).
 * status: DRAFT (Phiếu tạm) → CONFIRMED (Đã xác nhận) → COMPLETED (đã tạo hóa đơn) | CANCELLED.
 * id do máy bán hàng sinh (gửi lại cùng id không tạo trùng) → Persistable để INSERT thay vì merge.
 */
@Entity
@Table(name = "customer_orders")
@Getter
@Setter
@NoArgsConstructor
public class CustomerOrder implements Persistable<UUID> {

    @Id
    private UUID id;
    @Column(nullable = false, unique = true)
    private String code;
    @Column(name = "branch_id", nullable = false)
    private UUID branchId;
    @Column(name = "customer_id", nullable = false)
    private UUID customerId;
    @Column(name = "customer_name", nullable = false)
    private String customerName;
    @Column(name = "seller_id")
    private UUID sellerId;
    @Column(name = "seller_name")
    private String sellerName;
    @Column(name = "created_by", nullable = false)
    private UUID createdBy;
    @Column(name = "created_by_name", nullable = false)
    private String createdByName;
    @Column(name = "ordered_at", nullable = false)
    private Instant orderedAt;
    @Column(nullable = false)
    private String status = "DRAFT";
    @Column(nullable = false)
    private BigDecimal subtotal;
    @Column(nullable = false)
    private BigDecimal discount = BigDecimal.ZERO;
    @Column(nullable = false)
    private BigDecimal total;
    @Column(nullable = false)
    private BigDecimal deposit = BigDecimal.ZERO;
    private String note;
    @Column(name = "price_book_id")
    private UUID priceBookId;
    @Column(name = "price_book_name")
    private String priceBookName;
    @Column(name = "sales_channel", nullable = false)
    private String salesChannel = "DIRECT";
    /** Thời gian giao hàng hẹn với khách. */
    @Column(name = "expected_delivery_at")
    private Instant expectedDeliveryAt;
    @Column(name = "invoice_id")
    private UUID invoiceId;
    @Column(name = "cancelled_at")
    private Instant cancelledAt;
    /** "Gộp đơn": đơn gốc (đã hủy) trỏ sang đơn gộp. */
    @Column(name = "merged_into_id")
    private UUID mergedIntoId;
    /** Khu vực giao hàng (lọc danh sách): mặc định theo địa chỉ khách lúc tạo đơn, sửa ở chi tiết đơn. */
    @Column(name = "receiver_province")
    private String receiverProvince;
    @Column(name = "receiver_province_code")
    private String receiverProvinceCode;
    @Column(name = "receiver_ward")
    private String receiverWard;
    @Column(name = "receiver_ward_code")
    private String receiverWardCode;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("lineNo ASC")
    private List<CustomerOrderLine> lines = new ArrayList<>();

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

    /** Khu vực giao hàng theo địa chỉ khách (tỉnh + phường/xã, cả mã và tên). */
    public void areaFrom(com.vaxclinic.sales.customer.Customer c) {
        receiverProvince = c.getProvince();
        receiverProvinceCode = c.getProvinceCode();
        receiverWard = c.getWard();
        receiverWardCode = c.getWardCode();
    }

    /** Còn sửa / tạo hóa đơn / hủy được. */
    public boolean isOpen() {
        return "DRAFT".equals(status) || "CONFIRMED".equals(status);
    }
}
