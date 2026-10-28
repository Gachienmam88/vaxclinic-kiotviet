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
import java.time.LocalDate;
import java.util.UUID;

/** Khách hàng. debt / totalSales / totalReturns là số tổng hợp, nguồn gốc là hóa đơn + sổ công nợ. */
@Entity
@Table(name = "customers")
@Getter
@Setter
@NoArgsConstructor
public class Customer {

    @Id
    private UUID id;
    @Column(nullable = false, unique = true)
    private String code;
    @Column(nullable = false)
    private String name;
    private String phone;
    private String phone2;
    private String email;
    private String facebook;
    private LocalDate birthday;
    private String gender;
    private String address;
    private String province;
    private String ward;
    @Column(name = "group_id")
    private UUID groupId;
    /** Bản sao tên nhóm (customer_groups.name) — giữ cho API cũ. */
    @Column(name = "group_name")
    private String groupName;
    private String note;

    @Column(name = "customer_type", nullable = false)
    private String customerType = "PERSONAL";
    @Column(name = "buyer_name")
    private String buyerName;
    @Column(name = "company_name")
    private String companyName;
    @Column(name = "tax_code")
    private String taxCode;
    @Column(name = "invoice_address")
    private String invoiceAddress;
    @Column(name = "invoice_province")
    private String invoiceProvince;
    @Column(name = "invoice_ward")
    private String invoiceWard;
    /** Mã ĐVHC 2 cấp (tỉnh 2 số, phường/xã 5 số); null với dữ liệu cũ chỉ có tên. */
    @Column(name = "province_code")
    private String provinceCode;
    @Column(name = "ward_code")
    private String wardCode;
    @Column(name = "invoice_province_code")
    private String invoiceProvinceCode;
    @Column(name = "invoice_ward_code")
    private String invoiceWardCode;
    @Column(name = "id_number")
    private String idNumber;
    private String passport;
    @Column(name = "invoice_email")
    private String invoiceEmail;
    @Column(name = "invoice_phone")
    private String invoicePhone;
    @Column(name = "bank_name")
    private String bankName;
    @Column(name = "bank_account")
    private String bankAccount;

    @Column(nullable = false)
    private BigDecimal debt = BigDecimal.ZERO;
    @Column(name = "total_sales", nullable = false)
    private BigDecimal totalSales = BigDecimal.ZERO;
    @Column(name = "total_returns", nullable = false)
    private BigDecimal totalReturns = BigDecimal.ZERO;

    @Column(name = "branch_id")
    private UUID branchId;
    @Column(name = "created_by")
    private UUID createdBy;
    @Column(name = "created_by_name")
    private String createdByName;
    @Column(nullable = false)
    private boolean active = true;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
