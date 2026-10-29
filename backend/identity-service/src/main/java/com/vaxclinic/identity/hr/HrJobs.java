package com.vaxclinic.identity.hr;

import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.identity.hr.attendance.AttendanceWriter;
import com.vaxclinic.identity.hr.payroll.PayRates;
import com.vaxclinic.identity.hr.payroll.PayrollService;
import com.vaxclinic.identity.hr.schedule.ShiftRepository;
import com.vaxclinic.identity.hr.settings.HrSettingsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Việc nền của Nhân viên:
 * - Tự động tạo bảng tính lương cho kỳ hiện tại / tự cập nhật bảng lương đang tạm tính (thiết lập tính lương).
 * - Tự động chấm công: ca đã xếp lịch đã kết thúc mà chưa chấm → ghi đúng giờ (nguồn AUTO, chờ duyệt).
 */
@Configuration
@EnableScheduling
public class HrJobs {

    private static final Logger log = LoggerFactory.getLogger(HrJobs.class);

    private final HrJobsRepository repo;
    private final HrSettingsService settings;
    private final PayrollService payrolls;
    private final AttendanceWriter writer;
    private final ShiftRepository shiftRepo;

    public HrJobs(HrJobsRepository repo, HrSettingsService settings, PayrollService payrolls, AttendanceWriter writer,
                  ShiftRepository shiftRepo) {
        this.repo = repo;
        this.settings = settings;
        this.payrolls = payrolls;
        this.writer = writer;
        this.shiftRepo = shiftRepo;
    }

    /** 1 phút sau khi chạy rồi mỗi 6 giờ (bảng lương cập nhật nhiều lần trong ngày, không đợi nửa đêm). */
    @Scheduled(initialDelay = 60_000, fixedDelay = 6 * 3600_000)
    public void payrollJob() {
        var pr = settings.payroll();
        LocalDate today = LocalDate.now(ShopSettings.ZONE);
        try {
            if (pr.autoCreate()) {
                var period = PayRates.periodOf(today, pr.startDay());
                Long n = repo.countActivePayrolls(period.start());
                Long emps = repo.countSalariedWorkingEmployees();
                if (n != null && n == 0 && emps != null && emps > 0) {
                    payrolls.create(null, period.start(), period.end(), null, null);
                    log.info("Auto-created payroll for {}", period.start());
                }
            }
            if (pr.autoUpdate()) {
                for (UUID id : repo.tempPayrollIdsEndingFrom(today.minusDays(7))) {
                    payrolls.recalculate(id);
                }
            }
        } catch (RuntimeException e) {
            log.warn("Payroll auto job failed: {}", e.getMessage());
        }
    }

    @Scheduled(initialDelay = 90_000, fixedDelay = 3600_000)
    public void autoTimekeeping() {
        if (!settings.timekeeping().autoTimekeeping()) {
            return;
        }
        LocalDate today = LocalDate.now(ShopSettings.ZONE);
        Instant now = Instant.now();
        var shifts = shiftRepo.findAll();
        for (var row : repo.unclockedShifts(today.minusDays(3), today)) {
            shifts.stream().filter(x -> x.id().equals(row.shiftId())).findFirst().ifPresent(sh -> {
                var slot = AttendanceWriter.slot(sh, row.workDate());
                if (slot.end().isBefore(now)) {
                    writer.upsert(row.employeeId(), row.shiftId(), row.workDate(), slot.start(), slot.end(), null, null, false, "AUTO",
                            row.mainBranchId());
                }
            });
        }
    }
}
