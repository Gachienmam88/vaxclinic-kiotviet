package com.vaxclinic.product.internal;

import com.vaxclinic.product.internal.InternalStockService.StockDocRequest;
import com.vaxclinic.product.internal.InternalStockService.StockDocResult;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Chỉ cho service nội bộ (JWT có quyền "internal"); gateway không route /internal/**. */
@RestController
@PreAuthorize("hasAuthority('internal')")
public class InternalStockController {

    private final InternalStockService service;

    public InternalStockController(InternalStockService service) {
        this.service = service;
    }

    @PostMapping("/internal/stock-docs")
    public StockDocResult apply(@RequestBody StockDocRequest req) {
        return service.apply(req);
    }
}
