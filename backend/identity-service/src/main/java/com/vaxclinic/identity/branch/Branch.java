package com.vaxclinic.identity.branch;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** Điểm tiêm (chi nhánh) — đơn vị vận hành có kho vắc xin và quầy riêng. */
@Entity
@Table(name = "branches")
@Getter
@Setter
@NoArgsConstructor
public class Branch {

    @Id
    private UUID id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String name;

    private String address;

    /** Khu vực (tên) + mã ĐVHC 2 cấp; null với chi nhánh cũ. */
    private String province;

    private String ward;

    @Column(name = "province_code")
    private String provinceCode;

    @Column(name = "ward_code")
    private String wardCode;

    private String phone;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
