package com.vaxclinic.product.purchase;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Nhóm nhà cung cấp (/api/suppliers/groups): xem cần catalog.view, thêm/sửa/xóa cần inventory.manage. */
@RestController
@PreAuthorize("hasAuthority('catalog.view')")
public class SupplierGroupController {

    public record GroupRequest(@NotBlank(message = "Nhập tên nhóm") @Size(max = 100) String name, String note) {
    }

    public record GroupResponse(UUID id, String name, String note, long supplierCount) {
    }

    private final JdbcTemplate jdbc;
    private final AuditLogger audit;

    public SupplierGroupController(JdbcTemplate jdbc, AuditLogger audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @GetMapping("/api/suppliers/groups")
    public List<GroupResponse> list() {
        return jdbc.query("""
                select g.id, g.name, g.note, (select count(*) from suppliers s where s.group_id = g.id) n
                from supplier_groups g order by lower(g.name)""",
                (rs, i) -> new GroupResponse(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getLong(4)));
    }

    @PostMapping("/api/suppliers/groups")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory.manage')")
    @Transactional
    public GroupResponse create(@Valid @RequestBody GroupRequest req, @AuthenticationPrincipal Jwt jwt) {
        String name = req.name().trim();
        checkUnique(name, null);
        UUID id = UUID.randomUUID();
        jdbc.update("insert into supplier_groups(id, name, note) values (?, ?, ?)", id, name, req.note());
        log(jwt, "Thêm mới", "Tạo nhóm nhà cung cấp " + name);
        return new GroupResponse(id, name, req.note(), 0);
    }

    @PutMapping("/api/suppliers/groups/{id}")
    @PreAuthorize("hasAuthority('inventory.manage')")
    @Transactional
    public GroupResponse update(@PathVariable UUID id, @Valid @RequestBody GroupRequest req, @AuthenticationPrincipal Jwt jwt) {
        String name = req.name().trim();
        checkUnique(name, id);
        if (jdbc.update("update supplier_groups set name = ?, note = ? where id = ?", name, req.note(), id) == 0) {
            throw notFound();
        }
        log(jwt, "Sửa", "Sửa nhóm nhà cung cấp " + name);
        return list().stream().filter(g -> g.id().equals(id)).findFirst().orElseThrow();
    }

    /** Xóa nhóm: NCC trong nhóm chuyển về "Chưa có nhóm" (FK ON DELETE SET NULL). */
    @DeleteMapping("/api/suppliers/groups/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('inventory.manage')")
    @Transactional
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        List<String> names = jdbc.queryForList("delete from supplier_groups where id = ? returning name", String.class, id);
        if (names.isEmpty()) {
            throw notFound();
        }
        log(jwt, "Xóa", "Xóa nhóm nhà cung cấp " + names.get(0));
    }

    /** Dùng khi tạo NCC / import bằng tên nhóm: có thì lấy, chưa có thì tạo. */
    UUID findOrCreate(String name) {
        String n = name.trim();
        var found = jdbc.queryForList("select id from supplier_groups where lower(name) = lower(?)", UUID.class, n);
        if (!found.isEmpty()) {
            return found.get(0);
        }
        UUID id = UUID.randomUUID();
        jdbc.update("insert into supplier_groups(id, name) values (?, ?)", id, n);
        return id;
    }

    void requireExists(UUID id) {
        if (id != null && jdbc.queryForObject("select count(*) from supplier_groups where id = ?", Long.class, id) == 0) {
            throw BusinessException.badRequest("SUPPLIER_GROUP_NOT_FOUND", "Nhóm nhà cung cấp không tồn tại");
        }
    }

    private void checkUnique(String name, UUID exceptId) {
        Long n = jdbc.queryForObject("select count(*) from supplier_groups where lower(name) = lower(?) and id is distinct from ?",
                Long.class, name, exceptId == null ? new UUID(0, 0) : exceptId);
        if (n != null && n > 0) {
            throw BusinessException.conflict("SUPPLIER_GROUP_EXISTS", "Tên nhóm nhà cung cấp đã tồn tại");
        }
    }

    private static BusinessException notFound() {
        return BusinessException.notFound("SUPPLIER_GROUP_NOT_FOUND", "Không tìm thấy nhóm nhà cung cấp");
    }

    private void log(Jwt jwt, String action, String detail) {
        audit.record(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"), null, "Nhà cung cấp", action, null, detail);
    }
}
