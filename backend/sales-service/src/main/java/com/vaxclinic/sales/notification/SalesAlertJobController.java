package com.vaxclinic.sales.notification;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/** Chạy ngay job cảnh báo bán hàng. /internal/** không đi qua gateway; service nội bộ hoặc quản trị gọi thẳng cổng service. */
@RestController
@PreAuthorize("hasAuthority('internal') or hasAuthority('settings.manage')")
public class SalesAlertJobController {

    public record RunResult(int alerts) {
    }

    private final SalesAlertJob job;

    public SalesAlertJobController(SalesAlertJob job) {
        this.job = job;
    }

    @PostMapping("/internal/notification-jobs/run")
    public RunResult run() {
        return new RunResult(job.run());
    }
}
