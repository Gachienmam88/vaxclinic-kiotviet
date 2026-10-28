package com.vaxclinic.sales.cashbook;

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
 * Phiếu thu / phiếu chi của Sổ quỹ. amount luôn dương; voucherType quyết định chiều tiền.
 * sourceType: MANUAL (tạo tay), INVOICE (TT + mã hóa đơn), DEBT (thu nợ khách), PURCHASE (PC + mã phiếu nhập).
 */
@Entity
@Table(name = "cash_vouchers")
@Getter
@Setter
@NoArgsConstructor
public class CashVoucher {

    @Id
    private UUID id;
    @Column(nullable = false, unique = true)
    private String code;
    @Column(name = "voucher_type", nullable = false)
    private String voucherType; // RECEIPT / PAYMENT
    @Column(nullable = false)
    private String fund; // CASH / BANK / EWALLET
    @Column(name = "bank_account_id")
    private UUID bankAccountId;
    @Column(nullable = false)
    private String category;
    @Column(nullable = false)
    private BigDecimal amount;
    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;
    @Column(name = "branch_id", nullable = false)
    private UUID branchId;
    @Column(name = "partner_type", nullable = false)
    private String partnerType;
    @Column(name = "partner_id")
    private UUID partnerId;
    @Column(name = "partner_name")
    private String partnerName;
    @Column(name = "partner_phone")
    private String partnerPhone;
    @Column(name = "collector_id")
    private UUID collectorId;
    @Column(name = "collector_name")
    private String collectorName;
    @Column(name = "created_by")
    private UUID createdBy;
    @Column(name = "created_by_name")
    private String createdByName;
    @Column(nullable = false)
    private boolean accounting = true;
    @Column(name = "affects_debt", nullable = false)
    private boolean affectsDebt;
    @Column(nullable = false)
    private String status = "PAID";
    @Column(name = "source_type", nullable = false)
    private String sourceType = "MANUAL";
    @Column(name = "source_id")
    private UUID sourceId;
    private String note;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
