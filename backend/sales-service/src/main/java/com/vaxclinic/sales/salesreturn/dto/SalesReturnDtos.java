package com.vaxclinic.sales.salesreturn.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class SalesReturnDtos {

    private SalesReturnDtos() {
    }

    /**
     * Trả theo hóa đơn: invoiceLineId (+ quantity, unitPrice null = giá bán trên hóa đơn).
     * Trả nhanh (không hóa đơn): productId + unitId + quantity + unitPrice; lotNumber bắt buộc với hàng quản lý lô
     * (lô đã có tại chi nhánh: expiryDate bỏ trống hoặc trùng hạn của lô; lô mới: expiryDate bắt buộc → kho tạo lô).
     */
    public record LineInput(UUID invoiceLineId,
                            @NotNull @DecimalMin(value = "0.001", message = "Số lượng trả phải > 0") BigDecimal quantity,
                            @DecimalMin("0") BigDecimal unitPrice, UUID productId, UUID unitId,
                            @Size(max = 50) String lotNumber, LocalDate expiryDate) {
        public LineInput(UUID invoiceLineId, BigDecimal quantity, BigDecimal unitPrice) {
            this(invoiceLineId, quantity, unitPrice, null, null, null, null);
        }
    }

    /**
     * id do máy bán hàng sinh → gửi lại không tạo trùng. bankAccountId: tài khoản chi khi hoàn tiền chuyển khoản (tùy chọn).
     * invoiceId null = "Trả nhanh": dùng branchId (bắt buộc) + customerId (null = khách lẻ, phải hoàn đủ tiền).
     */
    public record ReturnRequest(@NotNull UUID id, UUID invoiceId, Instant returnedAt,
                                @NotEmpty(message = "Chưa chọn hàng trả") @Valid List<LineInput> lines,
                                @DecimalMin("0") BigDecimal discount, @DecimalMin("0") BigDecimal fee,
                                @DecimalMin("0") BigDecimal refundAmount,
                                @Pattern(regexp = "CASH|TRANSFER|CARD|EWALLET") String paymentMethod, UUID bankAccountId,
                                String note, UUID branchId, UUID customerId) {
        public ReturnRequest(UUID id, UUID invoiceId, Instant returnedAt, List<LineInput> lines, BigDecimal discount,
                             BigDecimal fee, BigDecimal refundAmount, String paymentMethod, UUID bankAccountId, String note) {
            this(id, invoiceId, returnedAt, lines, discount, fee, refundAmount, paymentMethod, bankAccountId, note, null, null);
        }
    }

    public record LineResponse(UUID id, UUID invoiceLineId, String productCode, String productName, String unitName,
                               BigDecimal quantity, BigDecimal unitPrice, BigDecimal amount, String lots) {
    }

    public record ReturnResponse(UUID id, String code, UUID invoiceId, String invoiceCode, UUID branchId, UUID customerId,
                                 String customerName, String createdByName, Instant returnedAt, String status,
                                 BigDecimal subtotal, BigDecimal discount, BigDecimal fee, BigDecimal total,
                                 BigDecimal refunded, String paymentMethod, String note, List<LineResponse> lines) {
    }

    /** GET /api/sales-returns: total = số phiếu, sumTotal = tổng "cần trả khách" của bộ lọc. */
    public record ListPage(List<ListItem> items, long total, BigDecimal sumTotal) {
    }

    public record ListItem(UUID id, String code, Instant returnedAt, String invoiceCode, String customerName,
                           BigDecimal subtotal, BigDecimal fee, BigDecimal total, BigDecimal refunded, String status) {
    }
}
