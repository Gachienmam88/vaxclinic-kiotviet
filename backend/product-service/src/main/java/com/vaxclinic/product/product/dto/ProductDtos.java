package com.vaxclinic.product.product.dto;

import com.vaxclinic.product.product.entity.ProductUnit;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Request/response DTOs của hàng hóa. */
public final class ProductDtos {

    private ProductDtos() {
    }

    /** id null = đơn vị mới. Phần tử đầu tiên của units là đơn vị cơ bản (conversionRate phải = 1). */
    public record UnitInput(UUID id,
                            @Size(max = 50) String code,
                            @Size(max = 100) String barcode,
                            @NotBlank(message = "Nhập tên đơn vị") @Size(max = 50) String unitName,
                            @NotNull @DecimalMin(value = "0.0001", message = "Giá trị quy đổi phải > 0") BigDecimal conversionRate,
                            @NotNull @DecimalMin("0") BigDecimal price,
                            boolean directSale) {
    }

    /** Tồn đầu kỳ khi tạo hàng: hàng theo lô thì nhập theo từng lô. */
    public record OpeningLot(@NotBlank @Size(max = 50) String lotNumber, @NotNull LocalDate expiryDate,
                             @NotNull @DecimalMin("0") BigDecimal quantity) {
    }

    public record OpeningStock(@NotNull UUID branchId, @DecimalMin("0") BigDecimal quantity,
                               @Valid List<OpeningLot> lots) {
    }

    public record ProductRequest(
            @NotBlank(message = "Nhập tên hàng") @Size(max = 250) String name,
            @Size(max = 100) String shortName,
            @Size(max = 250) String einvoiceName,
            @NotNull(message = "Chọn nhóm hàng") UUID categoryId,
            UUID taxRateId,
            boolean taxReduction,
            boolean lotManaged,
            @NotNull @DecimalMin("0") BigDecimal cost,
            @NotNull @DecimalMin("0") BigDecimal minStock,
            @NotNull @DecimalMin("0") BigDecimal maxStock,
            UUID positionId,
            @DecimalMin("0") BigDecimal weight,
            String weightUnit,
            String description,
            String note,
            boolean loyaltyPoints,
            @NotEmpty @Valid List<UnitInput> units,
            @Valid OpeningStock openingStock) {
    }

    public record UnitResponse(UUID id, String code, String barcode, String unitName, BigDecimal conversionRate,
                               BigDecimal price, boolean base, boolean directSale) {
        public static UnitResponse of(ProductUnit u) {
            return new UnitResponse(u.getId(), u.getCode(), u.getBarcode(), u.getUnitName(), u.getConversionRate(),
                    u.getPrice(), u.isBase(), u.isDirectSale());
        }
    }

    public record BranchStock(UUID branchId, BigDecimal quantity, BigDecimal reserved) {
    }

    public record ProductDetail(UUID id, String name, String shortName, String einvoiceName,
                                UUID categoryId, String categoryName, UUID taxRateId, String taxRateName,
                                boolean taxReduction, boolean lotManaged, BigDecimal cost,
                                BigDecimal minStock, BigDecimal maxStock, UUID positionId, String positionName,
                                BigDecimal weight, String weightUnit, String description, String note,
                                boolean loyaltyPoints, boolean active, Instant createdAt,
                                List<UnitResponse> units, List<BranchStock> stocks) {
    }

    /** 1 dòng danh sách hàng hóa (theo đơn vị cơ bản). */
    public record ProductListItem(UUID id, String code, String name, String shortName, String unitName,
                                  List<String> otherUnits, BigDecimal price, BigDecimal cost,
                                  String taxRateName, boolean taxReduction, boolean lotManaged,
                                  BigDecimal stock, BigDecimal reserved, boolean active) {
    }

    public record ProductListResponse(List<ProductListItem> items, long total, int page, int size,
                                      BigDecimal totalStock) {
    }

    public record LedgerLine(UUID id, String docType, String docCode, Instant occurredAt, UUID branchId,
                             String lotNumber, BigDecimal unitPrice, BigDecimal cost, BigDecimal quantity,
                             BigDecimal balanceAfter, String partnerName) {
    }

    public record LotResponse(UUID id, UUID branchId, String lotNumber, LocalDate expiryDate, BigDecimal quantity) {
    }
}
