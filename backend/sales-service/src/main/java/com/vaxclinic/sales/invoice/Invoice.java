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
    /** Hóa đơn tạo từ đơn đặt hàng (nút "Tạo hóa đơn"). */
    @Column(name = "order_id")
    private UUID orderId;
    /** Bảng giá áp dụng lúc bán (null = Bảng giá chung) + tên lưu lại. */
    @Column(name = "price_book_id")
    private UUID priceBookId;
    @Column(name = "price_book_name")
    private String priceBookName;
    /** Mã kênh bán (sales_channels), mặc định DIRECT "Bán trực tiếp". */
    @Column(name = "sales_channel", nullable = false)
    private String salesChannel = "DIRECT";
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
    /** "Thông tin xuất HĐĐT" nhập trên hóa đơn (null hết = lấy theo khách hàng). */
    @Column(name = "einvoice_buyer_name")
    private String einvoiceBuyerName;
    @Column(name = "einvoice_company_name")
    private String einvoiceCompanyName;
    @Column(name = "einvoice_tax_code")
    private String einvoiceTaxCode;
    @Column(name = "einvoice_address")
    private String einvoiceAddress;
    @Column(name = "einvoice_email")
    private String einvoiceEmail;
    @Column(name = "einvoice_phone")
    private String einvoicePhone;

    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("lineNo ASC")
    private List<InvoiceLine> lines = new ArrayList<>();

    @jakarta.persistence.Transient
    private boolean isNew = true;

    @Override
    public boolean isNew() {
        return isNew;
    }

    /** Ghi thông tin xuất HĐĐT từ màn bán hàng (null = xóa). */
    public void applyEInvoiceBuyer(InvoiceDtos.EInvoiceBuyer b) {
        einvoiceBuyerName = b == null ? null : blank(b.buyerName());
        einvoiceCompanyName = b == null ? null : blank(b.companyName());
        einvoiceTaxCode = b == null ? null : blank(b.taxCode());
        einvoiceAddress = b == null ? null : blank(b.address());
        einvoiceEmail = b == null ? null : blank(b.email());
        einvoicePhone = b == null ? null : blank(b.phone());
    }

    /** null khi không có thông tin xuất HĐĐT riêng. */
    public InvoiceDtos.EInvoiceBuyer einvoiceBuyer() {
        if (einvoiceBuyerName == null && einvoiceCompanyName == null && einvoiceTaxCode == null && einvoiceAddress == null
                && einvoiceEmail == null && einvoicePhone == null) {
            return null;
        }
        return new InvoiceDtos.EInvoiceBuyer(einvoiceBuyerName, einvoiceCompanyName, einvoiceTaxCode, einvoiceAddress,
                einvoiceEmail, einvoicePhone);
    }

    private static String blank(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    @jakarta.persistence.PostLoad
    @jakarta.persistence.PostPersist
    void markNotNew() {
        this.isNew = false;
    }
}
