package com.vaxclinic.product.notification;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Chạy ngay job cảnh báo kho (sau khi đổi thiết lập số ngày cảnh báo, hoặc kiểm thử). /internal/** không đi qua
 * gateway nên trình duyệt không gọi được; service nội bộ hoặc người quản trị gọi thẳng cổng service.
 */
@RestController
@PreAuthorize("hasAuthority('internal') or hasAuthority('settings.manage')")
public class StockAlertJobController {

    /** Số cảnh báo đã tạo: {"alerts": n}. */
    public record RunResult(int alerts) {
    }

    private final StockAlertJob job;

    public StockAlertJobController(StockAlertJob job) {
        this.job = job;
    }

    @PostMapping("/internal/notification-jobs/run")
    public RunResult run() {
        return new RunResult(job.run());
    }
}
