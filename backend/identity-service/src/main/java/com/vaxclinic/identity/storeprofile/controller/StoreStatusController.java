package com.vaxclinic.identity.storeprofile.controller;

import com.vaxclinic.identity.storeprofile.service.StoreStatusService;
import com.vaxclinic.identity.storeprofile.dto.StoreProfileModels.StoreStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * API công khai /api/auth/store-status: gateway (StoreStatusFilter) đọc định kỳ để chặn API (423) khi bảo lưu và từ chối
 * JWT cũ sau khi đổi tên gian hàng; màn hình đọc để hiện thông báo bảo lưu. Không lộ dữ liệu nào khác.
 * Luồng: StoreStatusController → StoreStatusService → SettingsStore (app_settings).
 */
@RestController
public class StoreStatusController {

    private final StoreStatusService service;

    public StoreStatusController(StoreStatusService service) {
        this.service = service;
    }

    @GetMapping("/api/auth/store-status")
    public StoreStatus status() {
        return service.status();
    }
}
