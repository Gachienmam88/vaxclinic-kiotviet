package com.vaxclinic.identity.hr.employee;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.hr.HrActor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Danh mục Phòng ban (/api/hr/departments) và Chức danh (/api/hr/job-titles) — nút "Tạo mới" ở bộ lọc danh sách nhân viên. */
@RestController
@PreAuthorize("hasAuthority('hr.manage')")
public class HrCatalogController {

    public record CatalogItem(UUID id, String name, int employeeCount) {
    }

    public record CatalogRequest(@NotBlank @Size(max = 100) String name) {
    }

    private record Kind(String table, String column, String label) {
    }

    private final JdbcTemplate jdbc;
    private final AuditLogger audit;

    public HrCatalogController(JdbcTemplate jdbc, AuditLogger audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    private static Kind kind(String path) {
        return switch (path) {
            case "departments" -> new Kind("hr_departments", "department_id", "phòng ban");
            case "job-titles" -> new Kind("hr_job_titles", "job_title_id", "chức danh");
            default -> throw BusinessException.notFound("NOT_FOUND", "Không tìm thấy danh mục");
        };
    }

    @GetMapping("/api/hr/{kind:departments|job-titles}")
    public List<CatalogItem> list(@PathVariable("kind") String path) {
        Kind k = kind(path);
        return jdbc.query("select c.id, c.name, (select count(*) from hr_employees e where e." + k.column + " = c.id) n from "
                + k.table + " c order by lower(c.name)", (rs, i) -> new CatalogItem(rs.getObject(1, UUID.class), rs.getString(2), rs.getInt(3)));
    }

    @PostMapping("/api/hr/{kind:departments|job-titles}")
    @ResponseStatus(HttpStatus.CREATED)
    public CatalogItem create(@PathVariable("kind") String path, @Valid @RequestBody CatalogRequest req, @AuthenticationPrincipal Jwt jwt) {
        Kind k = kind(path);
        UUID id = UUID.randomUUID();
        try {
            jdbc.update("insert into " + k.table + "(id, name) values (?, ?)", id, req.name().trim());
        } catch (DuplicateKeyException e) {
            throw BusinessException.conflict("NAME_EXISTS", "Tên " + k.label + " đã tồn tại");
        }
        HrActor.of(jwt).audit(audit, "Tạo", "Tạo " + k.label + " " + req.name().trim());
        return new CatalogItem(id, req.name().trim(), 0);
    }

    @PutMapping("/api/hr/{kind:departments|job-titles}/{id}")
    public CatalogItem update(@PathVariable("kind") String path, @PathVariable UUID id, @Valid @RequestBody CatalogRequest req,
                              @AuthenticationPrincipal Jwt jwt) {
        Kind k = kind(path);
        int n;
        try {
            n = jdbc.update("update " + k.table + " set name = ? where id = ?", req.name().trim(), id);
        } catch (DuplicateKeyException e) {
            throw BusinessException.conflict("NAME_EXISTS", "Tên " + k.label + " đã tồn tại");
        }
        if (n == 0) {
            throw BusinessException.notFound("NOT_FOUND", "Không tìm thấy " + k.label);
        }
        HrActor.of(jwt).audit(audit, "Sửa", "Đổi tên " + k.label + " thành " + req.name().trim());
        return list(path).stream().filter(c -> c.id().equals(id)).findFirst().orElseThrow();
    }

    @DeleteMapping("/api/hr/{kind:departments|job-titles}/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable("kind") String path, @PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        Kind k = kind(path);
        jdbc.update("update hr_employees set " + k.column + " = null where " + k.column + " = ?", id);
        if (jdbc.update("delete from " + k.table + " where id = ?", id) > 0) {
            HrActor.of(jwt).audit(audit, "Xóa", "Xóa " + k.label);
        }
    }
}
