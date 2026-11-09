package com.vaxclinic.product.purchase.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** DTO sổ công nợ NCC (tab "Nợ cần trả nhà cung cấp", popup Thanh toán / Chiết khấu thanh toán / Điều chỉnh / Phiếu chi). */
public final class SupplierDebtDtos {

    private SupplierDebtDtos() {
    }

    public record AllocationInput(@NotNull UUID receiptId, @NotNull @DecimalMin("0") BigDecimal amount) {
    }

    /**
     * Thanh toán (phiếu chi) hoặc chiết khấu thanh toán. allocate = true: allocations null → tự phân bổ phiếu cũ trước;
     * phần vượt tổng còn cần trả = chưa phân bổ (trả trước, nợ có thể âm). paymentMethod/bankAccountId chỉ dùng cho thanh toán.
     */
    public record PaymentRequest(@NotNull(message = "Chọn chi nhánh") UUID branchId, Instant occurredAt, UUID staffId,
                                 @Size(max = 150) String staffName,
                                 @Pattern(regexp = "CASH|TRANSFER|EWALLET", message = "Phương thức thanh toán không hợp lệ") String paymentMethod,
                                 UUID bankAccountId,
                                 @NotNull(message = "Nhập số tiền") @DecimalMin(value = "1", message = "Số tiền phải lớn hơn 0") BigDecimal amount,
                                 String note, boolean allocate, List<@Valid AllocationInput> allocations) {
    }

    /** Điều chỉnh: newDebt = giá trị nợ mới; phát sinh = newDebt − nợ hiện tại. */
    public record AdjustmentRequest(@NotNull(message = "Chọn chi nhánh") UUID branchId, Instant occurredAt,
                                    @NotNull(message = "Nhập giá trị nợ điều chỉnh") BigDecimal newDebt, String note) {
    }

    /** "Lưu" ở popup phiếu: sửa thời gian / nhân viên / ghi chú (không đổi số tiền). */
    public record DocUpdateRequest(Instant occurredAt, UUID staffId, @Size(max = 150) String staffName, String note) {
    }

    /** docType: PURCHASE | PURCHASE_RETURN | PAYMENT | DISCOUNT | ADJUSTMENT; amount > 0 tăng nợ; balance = nợ sau phát sinh. */
    public record LedgerRow(UUID docId, String docType, String docCode, Instant occurredAt, BigDecimal amount,
                            BigDecimal balance) {
    }

    /** Tab "Lịch sử nhập/trả hàng": kind RECEIPT | RETURN, status DocStatus. */
    public record HistoryRow(UUID id, String kind, String code, Instant time, String createdByName, BigDecimal total,
                             String status) {
    }

    /** Phiếu nhập còn nợ để phân bổ: paidBefore = Σ đã trả + đã chiết khấu. */
    public record UnpaidReceipt(UUID id, String code, Instant receivedAt, BigDecimal total, BigDecimal paidBefore,
                                BigDecimal remaining) {
    }

    public record DocAllocation(UUID receiptId, String code, Instant receivedAt, BigDecimal total, BigDecimal paidBefore,
                                BigDecimal amount, boolean fullyPaid) {
    }

    public record DocDetail(UUID id, String code, String kind, String status, UUID supplierId, String supplierCode,
                            String supplierName, UUID branchId, Instant occurredAt, BigDecimal amount, String paymentMethod,
                            UUID bankAccountId, UUID staffId, String staffName, String createdByName, String note,
                            UUID receiptId, List<DocAllocation> allocations, BigDecimal unallocated) {
    }
}
