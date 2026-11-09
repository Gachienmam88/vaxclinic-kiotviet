package com.vaxclinic.integration.storeprofile.controller;

import com.vaxclinic.integration.storeprofile.dto.EInvoicePackageDtos.PackageRequest;
import com.vaxclinic.integration.storeprofile.dto.EInvoicePackageDtos.Summary;
import com.vaxclinic.integration.storeprofile.service.EInvoicePackageService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Hồ sơ cửa hàng → Hóa đơn điện tử: tài khoản MISA (từ thiết lập HĐĐT), tổng tài nguyên / đã phát hành / còn lại và
 * danh sách gói hóa đơn (nhập tay). "Còn lại" = tổng số còn lại của các gói chưa hết hạn.
 */
@RestController
@RequestMapping("/api/store-profile/einvoice")
@PreAuthorize("hasAuthority('settings.manage')")
public class EInvoicePackageController {

    private final EInvoicePackageService service;

    public EInvoicePackageController(EInvoicePackageService service) {
        this.service = service;
    }

    @GetMapping
    public Summary summary() {
        return service.summary();
    }

    @PostMapping("/packages")
    public Summary create(@Valid @RequestBody PackageRequest r) {
        return service.create(r);
    }

    @PutMapping("/packages/{id}")
    public Summary update(@PathVariable UUID id, @Valid @RequestBody PackageRequest r) {
        return service.update(id, r);
    }

    @DeleteMapping("/packages/{id}")
    public Summary delete(@PathVariable UUID id) {
        return service.delete(id);
    }
}
