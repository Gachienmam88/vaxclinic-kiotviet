package com.vaxclinic.integration.notification;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Chạy ngay job cảnh báo tích hợp. /internal/** không đi qua gateway; service nội bộ hoặc quản trị gọi thẳng cổng service. */
@RestController
@PreAuthorize("hasAuthority('internal') or hasAuthority('settings.manage')")
public class IntegrationAlertJobController {

    private final IntegrationAlertJob job;

    public IntegrationAlertJobController(IntegrationAlertJob job) {
        this.job = job;
    }

    @PostMapping("/internal/notification-jobs/run")
    public Map<String, Integer> run() {
        return Map.of("einvoiceFailed", job.einvoiceFailures(), "sepayReceived", job.sepayReceipts());
    }
}
