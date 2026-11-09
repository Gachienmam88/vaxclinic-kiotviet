package com.vaxclinic.product.purchase.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/** Request/response của nhóm nhà cung cấp (/api/suppliers/groups). */
public final class SupplierGroupDtos {

    private SupplierGroupDtos() {
    }

    public record GroupRequest(@NotBlank(message = "Nhập tên nhóm") @Size(max = 100) String name, String note) {
    }

    public record GroupResponse(UUID id, String name, String note, long supplierCount) {
    }
}
