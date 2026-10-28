package com.vaxclinic.identity.hr.commission;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.hr.HrActor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Bảng hoa hồng: mỗi bảng có mức hoa hồng theo mặt hàng (% doanh thu hoặc số tiền / 1 đơn vị bán) và danh sách nhân viên áp dụng.
 * Áp theo nhóm hàng: màn hình gửi mức cho toàn bộ mặt hàng của nhóm.
 */
@RestController
@RequestMapping("/api/hr/commission-tables")
@PreAuthorize("hasAuthority('hr.manage')")
public class CommissionController {

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

    private final JdbcTemplate jdbc;
    private final AuditLogger audit;

    public CommissionController(JdbcTemplate jdbc, AuditLogger audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @GetMapping
    public List<Table> list() {
        return jdbc.query("""
                select t.id, t.name, t.active, (select count(*) from hr_commission_rules r where r.table_id = t.id),
                  (select count(*) from hr_employees e where e.commission_table_id = t.id) from hr_commission_tables t order by lower(t.name)""",
                (rs, i) -> new Table(rs.getObject(1, UUID.class), rs.getString(2), rs.getBoolean(3), rs.getInt(4), rs.getInt(5)));
    }

    @GetMapping("/rules")
    public List<Rule> rules() {
        return jdbc.query("select table_id, product_id, rate_type, value from hr_commission_rules",
                (rs, i) -> new Rule(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3), rs.getBigDecimal(4)));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Table create(@Valid @RequestBody TableRequest req, @AuthenticationPrincipal Jwt jwt) {
        UUID id = UUID.randomUUID();
        try {
            jdbc.update("insert into hr_commission_tables(id, name, active) values (?,?,?)", id, req.name().trim(), req.active() == null || req.active());
        } catch (DuplicateKeyException e) {
            throw BusinessException.conflict("NAME_EXISTS", "Tên bảng hoa hồng đã tồn tại");
        }
        HrActor.of(jwt).audit(audit, "Tạo", "Tạo bảng hoa hồng " + req.name().trim());
        return find(id);
    }

    @PutMapping("/{id}")
    public Table update(@PathVariable UUID id, @Valid @RequestBody TableRequest req, @AuthenticationPrincipal Jwt jwt) {
        try {
            if (jdbc.update("update hr_commission_tables set name = ?, active = ? where id = ?", req.name().trim(),
                    req.active() == null || req.active(), id) == 0) {
                throw BusinessException.notFound("TABLE_NOT_FOUND", "Không tìm thấy bảng hoa hồng");
            }
        } catch (DuplicateKeyException e) {
            throw BusinessException.conflict("NAME_EXISTS", "Tên bảng hoa hồng đã tồn tại");
        }
        HrActor.of(jwt).audit(audit, "Sửa", "Cập nhật bảng hoa hồng " + req.name().trim());
        return find(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        Table t = find(id);
        jdbc.update("delete from hr_commission_tables where id = ?", id);
        HrActor.of(jwt).audit(audit, "Xóa", "Xóa bảng hoa hồng " + t.name());
    }

    @PutMapping("/{id}/rules")
    @Transactional
    public Table saveRules(@PathVariable UUID id, @Valid @RequestBody RulesRequest req, @AuthenticationPrincipal Jwt jwt) {
        Table t = find(id);
        for (RuleItem it : req.items()) {
            if (it.value() == null) {
                jdbc.update("delete from hr_commission_rules where table_id = ? and product_id = ?", id, it.productId());
                continue;
            }
            String type = it.rateType() == null ? "PERCENT" : it.rateType();
            if ("PERCENT".equals(type) && it.value().compareTo(BigDecimal.valueOf(100)) > 0) {
                throw BusinessException.badRequest("INVALID_RATE", "Hoa hồng theo % không được vượt quá 100%");
            }
            jdbc.update("""
                    insert into hr_commission_rules(table_id, product_id, rate_type, value) values (?,?,?,?)
                    on conflict (table_id, product_id) do update set rate_type = excluded.rate_type, value = excluded.value""",
                    id, it.productId(), type, it.value());
        }
        HrActor.of(jwt).audit(audit, "Sửa", "Cập nhật " + req.items().size() + " mức hoa hồng của bảng " + t.name());
        return find(id);
    }

    @GetMapping("/{id}/employees")
    public List<UUID> employees(@PathVariable UUID id) {
        return jdbc.queryForList("select id from hr_employees where commission_table_id = ? order by code", UUID.class, id);
    }

    /** Đặt danh sách nhân viên áp dụng bảng (nhân viên khác đang dùng bảng này sẽ bỏ áp dụng). */
    @PutMapping("/{id}/employees")
    @Transactional
    public Table saveEmployees(@PathVariable UUID id, @Valid @RequestBody EmployeesRequest req, @AuthenticationPrincipal Jwt jwt) {
        Table t = find(id);
        jdbc.update("update hr_employees set commission_table_id = null where commission_table_id = ?", id);
        req.employeeIds().forEach(e -> jdbc.update("update hr_employees set commission_table_id = ? where id = ?", id, e));
        HrActor.of(jwt).audit(audit, "Sửa", "Áp dụng bảng hoa hồng " + t.name() + " cho " + req.employeeIds().size() + " nhân viên");
        return find(id);
    }

    private Table find(UUID id) {
        return list().stream().filter(t -> t.id().equals(id)).findFirst()
                .orElseThrow(() -> BusinessException.notFound("TABLE_NOT_FOUND", "Không tìm thấy bảng hoa hồng"));
    }
}
