package com.vaxclinic.identity.hr.employee.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/** Request / response của danh mục Phòng ban / Chức danh. */
public final class HrCatalogDtos {

    private HrCatalogDtos() {
    }

    public record CatalogItem(UUID id, String name, int employeeCount) {
    }

    public record CatalogRequest(@NotBlank @Size(max = 100) String name) {
    }
}
