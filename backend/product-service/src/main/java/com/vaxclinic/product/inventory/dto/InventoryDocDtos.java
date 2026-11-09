package com.vaxclinic.product.inventory.dto;

import com.vaxclinic.product.purchase.dto.PurchaseDtos.Actor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.security.oauth2.jwt.Jwt;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** DTO kiểm kho + xuất hủy / xuất dùng nội bộ. Số lượng kiểm kho theo đơn vị cơ bản. */
public final class InventoryDocDtos {

    private InventoryDocDtos() {
    }

    /** Người dùng hiện tại lấy từ JWT (giống PurchaseController). */
    public static Actor actor(Jwt jwt) {
        List<String> branches = jwt.getClaimAsStringList("branches");
        return new Actor(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"),
                branches == null ? List.of() : branches);
    }

    // ===== Kiểm kho =====

    /** actualQuantity null = chưa kiểm. expiryDate chỉ cần khi kiểm ra 1 lô chưa có trong kho. */
    public record TakeLineInput(@NotNull UUID productId, @Size(max = 50) String lotNumber, LocalDate expiryDate,
                                @DecimalMin(value = "0", message = "Số lượng thực tế không được âm") BigDecimal actualQuantity) {
    }

    public record TakeRequest(@NotNull UUID branchId, String note, @Valid List<TakeLineInput> lines) {
    }

    public record TakeLineResponse(UUID id, int lineNo, UUID productId, String productCode, String productName,
                                   String unitName, boolean lotManaged, String lotNumber, LocalDate expiryDate,
                                   BigDecimal systemQuantity, BigDecimal actualQuantity, BigDecimal diffQuantity,
                                   BigDecimal cost, BigDecimal diffValue) {
    }

    public record TakeResponse(UUID id, String code, UUID branchId, String status, Instant takenAt, Instant balancedAt,
                               UUID createdBy, String createdByName, String note, BigDecimal actualQuantity,
                               BigDecimal actualValue, BigDecimal diffValue, BigDecimal increaseQuantity,
                               BigDecimal decreaseQuantity, List<TakeLineResponse> lines) {
    }

    public record TakeListItem(UUID id, String code, UUID branchId, String status, Instant takenAt, Instant balancedAt,
                               String createdByName, BigDecimal actualQuantity, BigDecimal actualValue,
                               BigDecimal diffValue, BigDecimal increaseQuantity, BigDecimal decreaseQuantity,
                               String note) {
    }

    // ===== Xuất hủy / xuất dùng nội bộ =====

    public record IssueLineInput(@NotNull UUID productId, @NotNull UUID unitId,
                                 @NotNull @DecimalMin(value = "0.001", message = "Số lượng phải > 0") BigDecimal quantity,
                                 @Size(max = 50) String lotNumber) {
    }

    public record IssueRequest(@NotNull UUID branchId, Instant issuedAt, @Size(max = 250) String reason, String note,
                               @Valid List<IssueLineInput> lines) {
    }

    public record IssueLineResponse(UUID id, int lineNo, UUID productId, String productCode, String productName,
                                    UUID unitId, String unitName, BigDecimal conversionRate, BigDecimal quantity,
                                    BigDecimal unitCost, BigDecimal value, String lotNumber, LocalDate expiryDate) {
    }

    public record IssueResponse(UUID id, String code, String type, UUID branchId, String status, Instant issuedAt,
                                UUID createdBy, String createdByName, String reason, String note,
                                BigDecimal totalQuantity, BigDecimal totalValue, Instant completedAt,
                                Instant cancelledAt, List<IssueLineResponse> lines) {
    }

    public record IssueListItem(UUID id, String code, String type, UUID branchId, String status, Instant issuedAt,
                                String createdByName, String reason, String note, BigDecimal totalQuantity,
                                BigDecimal totalValue) {
    }
}
