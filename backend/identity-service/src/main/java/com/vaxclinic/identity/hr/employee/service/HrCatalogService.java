package com.vaxclinic.identity.hr.employee.service;

import com.vaxclinic.identity.hr.employee.repository.HrCatalogRepository;
import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.hr.dto.HrActor;
import com.vaxclinic.identity.hr.employee.dto.HrCatalogDtos.CatalogItem;
import com.vaxclinic.identity.hr.employee.dto.HrCatalogDtos.CatalogRequest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/** Danh mục Phòng ban ("departments") và Chức danh ("job-titles"). */
@Service
public class HrCatalogService {

    private record Kind(String table, String column, String label) {
    }

    private final HrCatalogRepository catalogs;
    private final AuditLogger audit;

    public HrCatalogService(HrCatalogRepository catalogs, AuditLogger audit) {
        this.catalogs = catalogs;
        this.audit = audit;
    }

    private static Kind kind(String path) {
        return switch (path) {
            case "departments" -> new Kind("hr_departments", "department_id", "phòng ban");
            case "job-titles" -> new Kind("hr_job_titles", "job_title_id", "chức danh");
            default -> throw BusinessException.notFound("NOT_FOUND", "Không tìm thấy danh mục");
        };
    }

    public List<CatalogItem> list(String path) {
        Kind k = kind(path);
        return catalogs.list(k.table, k.column);
    }

    public CatalogItem create(String path, CatalogRequest req, HrActor actor) {
        Kind k = kind(path);
        UUID id = UUID.randomUUID();
        try {
            catalogs.insert(k.table, id, req.name().trim());
        } catch (DuplicateKeyException e) {
            throw BusinessException.conflict("NAME_EXISTS", "Tên " + k.label + " đã tồn tại");
        }
        actor.audit(audit, "Tạo", "Tạo " + k.label + " " + req.name().trim());
        return new CatalogItem(id, req.name().trim(), 0);
    }

    public CatalogItem update(String path, UUID id, CatalogRequest req, HrActor actor) {
        Kind k = kind(path);
        int n;
        try {
            n = catalogs.rename(k.table, id, req.name().trim());
        } catch (DuplicateKeyException e) {
            throw BusinessException.conflict("NAME_EXISTS", "Tên " + k.label + " đã tồn tại");
        }
        if (n == 0) {
            throw BusinessException.notFound("NOT_FOUND", "Không tìm thấy " + k.label);
        }
        actor.audit(audit, "Sửa", "Đổi tên " + k.label + " thành " + req.name().trim());
        return list(path).stream().filter(c -> c.id().equals(id)).findFirst().orElseThrow();
    }

    public void delete(String path, UUID id, HrActor actor) {
        Kind k = kind(path);
        catalogs.unassignEmployees(k.column, id);
        if (catalogs.delete(k.table, id) > 0) {
            actor.audit(audit, "Xóa", "Xóa " + k.label);
        }
    }
}
