package com.vaxclinic.identity.hr.commission;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** DTO màn Bảng hoa hồng. */
public final class CommissionModels {

    private CommissionModels() {
    }

    public record Table(UUID id, String name, boolean active, int ruleCount, int employeeCount) {
    }

    public record TableRequest(@NotBlank @Size(max = 150) String name, Boolean active) {
    }

    public record Rule(UUID tableId, UUID productId, String rateType, BigDecimal value) {
    }

    /** value null → bỏ mức hoa hồng của mặt hàng khỏi bảng. */
    public record RuleItem(@NotNull UUID productId, @Pattern(regexp = "PERCENT|AMOUNT") String rateType, @DecimalMin("0") BigDecimal value) {
    }

    public record RulesRequest(@NotNull @Size(max = 5000) List<@Valid RuleItem> items) {
    }

    public record EmployeesRequest(@NotNull List<UUID> employeeIds) {
    }
}
