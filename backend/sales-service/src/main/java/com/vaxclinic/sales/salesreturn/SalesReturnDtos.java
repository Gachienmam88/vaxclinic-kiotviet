package com.vaxclinic.sales.salesreturn;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class SalesReturnDtos {

    private SalesReturnDtos() {
    }

    /** unitPrice null = giá bán trên hóa đơn (đơn giá − giảm giá dòng). */
    public record LineInput(@NotNull UUID invoiceLineId,
                            @NotNull @DecimalMin(value = "0.001", message = "Số lượng trả phải > 0") BigDecimal quantity,
                            @DecimalMin("0") BigDecimal unitPrice) {
    }

    /** id do máy bán hàng sinh → gửi lại không tạo trùng. */
    public record ReturnRequest(@NotNull UUID id, @NotNull UUID invoiceId, Instant returnedAt,
                                @NotEmpty(message = "Chưa chọn hàng trả") @Valid List<LineInput> lines,
                                @DecimalMin("0") BigDecimal discount, @DecimalMin("0") BigDecimal fee,
                                @DecimalMin("0") BigDecimal refundAmount,
                                @Pattern(regexp = "CASH|TRANSFER|CARD|EWALLET") String paymentMethod, String note) {
    }

    public record LineResponse(UUID id, UUID invoiceLineId, String productCode, String productName, String unitName,
                               BigDecimal quantity, BigDecimal unitPrice, BigDecimal amount, String lots) {
    }

    public record ReturnResponse(UUID id, String code, UUID invoiceId, String invoiceCode, UUID branchId, UUID customerId,
                                 String customerName, String createdByName, Instant returnedAt, String status,
                                 BigDecimal subtotal, BigDecimal discount, BigDecimal fee, BigDecimal total,
                                 BigDecimal refunded, String paymentMethod, String note, List<LineResponse> lines) {
    }

    public record ListItem(UUID id, String code, Instant returnedAt, String invoiceCode, String customerName,
                           BigDecimal subtotal, BigDecimal fee, BigDecimal total, BigDecimal refunded, String status) {
    }
}
