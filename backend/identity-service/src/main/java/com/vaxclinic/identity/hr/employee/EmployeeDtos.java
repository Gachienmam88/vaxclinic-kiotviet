package com.vaxclinic.identity.hr.employee;

import com.vaxclinic.identity.hr.settings.HrSettings.PayItem;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** DTO hồ sơ nhân viên. salaryType: SHIFT / HOUR / STANDARD_DAY / FIXED; null = chưa thiết lập lương (biểu tượng cảnh báo). */
public final class EmployeeDtos {

    private EmployeeDtos() {
    }

    public record EmployeeRequest(@Size(max = 20) @Pattern(regexp = "[A-Za-z0-9_.-]*", message = "Mã nhân viên chỉ gồm chữ, số") String code,
                                  @Size(max = 30) String timekeepingCode,
                                  @NotBlank @Size(max = 150) String name,
                                  @Size(max = 20) String phone,
                                  @Size(max = 20) String idNumber,
                                  LocalDate birthday,
                                  @Pattern(regexp = "MALE|FEMALE") String gender,
                                  LocalDate startDate,
                                  UUID mainBranchId,
                                  List<UUID> branchIds,
                                  UUID departmentId,
                                  UUID jobTitleId,
                                  UUID userId,
                                  @Pattern(regexp = "WORKING|QUIT") String status,
                                  @Size(max = 500) String note,
                                  @Pattern(regexp = "SHIFT|HOUR|STANDARD_DAY|FIXED") String salaryType,
                                  @DecimalMin("0") BigDecimal salaryAmount,
                                  @DecimalMin("0") @DecimalMax("1000") BigDecimal overtimePercent,
                                  UUID commissionTableId,
                                  List<@Valid PayItem> allowances,
                                  List<@Valid PayItem> deductions) {
    }

    /** Dòng danh sách nhân viên (cột KiotViet) + thông tin cho lưới lịch / chấm công. */
    public record EmployeeRow(UUID id, String code, String timekeepingCode, String name, String phone, String idNumber,
                              BigDecimal debt, String note, String status, String salaryType, BigDecimal salaryAmount,
                              UUID departmentId, String departmentName, UUID jobTitleId, String jobTitleName,
                              UUID mainBranchId, UUID userId) {
    }

    public record BranchRef(UUID id, String name) {
    }

    public record Employee(UUID id, String code, String timekeepingCode, String name, String phone, String idNumber,
                           LocalDate birthday, String gender, LocalDate startDate, UUID mainBranchId, List<BranchRef> branches,
                           UUID departmentId, String departmentName, UUID jobTitleId, String jobTitleName,
                           UUID userId, String username, String status, String note,
                           String salaryType, BigDecimal salaryAmount, BigDecimal overtimePercent,
                           UUID commissionTableId, String commissionTableName,
                           List<PayItem> allowances, List<PayItem> deductions, BigDecimal debt) {
    }

    /** Tạm ứng: fund CASH / BANK — ghi phiếu chi "Chi tạm ứng lương nhân viên" vào Sổ quỹ. */
    public record AdvanceRequest(@DecimalMin("1") BigDecimal amount, @Pattern(regexp = "CASH|BANK") String fund,
                                 UUID branchId, @Size(max = 300) String note) {
    }

    public record AdvanceItem(UUID id, String kind, BigDecimal amount, java.time.Instant occurredAt, String note, boolean cancelled) {
    }
}
