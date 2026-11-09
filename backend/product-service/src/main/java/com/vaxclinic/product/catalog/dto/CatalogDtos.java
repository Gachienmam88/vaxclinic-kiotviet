package com.vaxclinic.product.catalog.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

/** Request/response của nhóm hàng, tỷ lệ thuế, vị trí. */
public final class CatalogDtos {

    private CatalogDtos() {
    }

    public record CategoryRequest(@NotBlank @Size(max = 150) String name, UUID parentId) {
    }

    public record CategoryResponse(UUID id, String name, UUID parentId) {
    }

    public record TaxRateResponse(UUID id, String code, String name, BigDecimal vatRate) {
    }

    public record PositionRequest(@NotBlank @Size(max = 100) String name) {
    }

    public record PositionResponse(UUID id, String name) {
    }
}
