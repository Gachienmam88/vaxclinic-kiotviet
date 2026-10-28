package com.vaxclinic.product.purchase;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** Nhà cung cấp vắc xin / vật tư. Thông tin xuất hóa đơn dùng để khớp hóa đơn đầu vào theo MST. */
@Entity
@Table(name = "suppliers")
@Getter
@Setter
@NoArgsConstructor
public class Supplier {

    @Id
    private UUID id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String name;

    private String phone;
    private String email;
    private String address;
    private String province;
    private String ward;

    /** Mã ĐVHC (tỉnh 2 số, phường/xã 5 số); null với dữ liệu cũ chỉ có tên. */
    @Column(name = "province_code")
    private String provinceCode;

    @Column(name = "ward_code")
    private String wardCode;

    @Column(name = "group_id")
    private UUID groupId;

    /** Chi nhánh nơi tạo NCC (chỉ để hiển thị). */
    @Column(name = "branch_id")
    private UUID branchId;

    @Column(name = "created_by", updatable = false)
    private UUID createdBy;

    @Column(name = "created_by_name", updatable = false)
    private String createdByName;

    private String note;

    @Column(name = "company_name")
    private String companyName;

    @Column(name = "tax_code")
    private String taxCode;

    @Column(name = "id_number")
    private String idNumber;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
