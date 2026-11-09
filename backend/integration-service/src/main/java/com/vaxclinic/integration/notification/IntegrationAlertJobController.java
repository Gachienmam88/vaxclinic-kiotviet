package com.vaxclinic.integration.notification;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/** Chạy ngay job cảnh báo tích hợp. /internal/** không đi qua gateway; service nội bộ hoặc quản trị gọi thẳng cổng service. */
@RestController
@PreAuthorize("hasAuthority('internal') or hasAuthority('settings.manage')")
public class IntegrationAlertJobController {

    /** Số cảnh báo đã gửi theo từng job (-1 nếu không gửi được tới identity-service). */
    public record RunResult(int einvoiceFailed, int sepayReceived) {
    }

    private final IntegrationAlertJob job;

    public IntegrationAlertJobController(IntegrationAlertJob job) {
        this.job = job;
    }

    @PostMapping("/internal/notification-jobs/run")
    public RunResult run() {
        return new RunResult(job.einvoiceFailures(), job.sepayReceipts());
    }
}
