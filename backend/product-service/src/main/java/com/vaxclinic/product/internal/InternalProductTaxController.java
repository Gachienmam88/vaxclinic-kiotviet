package com.vaxclinic.product.internal;

import com.vaxclinic.product.internal.ProductTaxInfoRepository.ProductTaxInfo;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Thông tin thuế của hàng (mã thuế suất, cờ giảm thuế, chuỗi nhóm hàng) — sales-service tự tra khi tính "Giảm thuế",
 * không tin dữ liệu máy bán hàng gửi lên. Chỉ cho service nội bộ (JWT quyền "internal"); gateway không route /internal/**.
 */
@RestController
@PreAuthorize("hasAuthority('internal')")
public class InternalProductTaxController {

    public record TaxInfoRequest(@NotNull @Size(max = 500) List<UUID> productIds) {
    }

    private final InternalProductTaxService service;

    public InternalProductTaxController(InternalProductTaxService service) {
        this.service = service;
    }

    @PostMapping("/internal/products/tax-info")
    public List<ProductTaxInfo> taxInfo(@Valid @RequestBody TaxInfoRequest req) {
        return service.taxInfo(req.productIds());
    }
}
