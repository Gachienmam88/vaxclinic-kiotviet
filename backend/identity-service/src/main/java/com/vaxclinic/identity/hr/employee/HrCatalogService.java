package com.vaxclinic.identity.hr.employee;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.hr.HrActor;
import com.vaxclinic.identity.hr.employee.HrCatalogController.CatalogItem;
import com.vaxclinic.identity.hr.employee.HrCatalogRepository.Kind;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/** Danh mục Phòng ban ("departments") / Chức danh ("job-titles"): tên không trùng; xóa thì bỏ gán khỏi nhân viên. */
@Service
public class HrCatalogService {

    private final HrCatalogRepository repo;
    private final AuditLogger audit;

    public HrCatalogService(HrCatalogRepository repo, AuditLogger audit) {
        this.repo = repo;
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
        return repo.findAll(kind(path));
    }

    public CatalogItem create(String path, String name, HrActor actor) {
        Kind k = kind(path);
        UUID id = UUID.randomUUID();
        try {
            repo.insert(k, id, name.trim());
        } catch (DuplicateKeyException e) {
            throw BusinessException.conflict("NAME_EXISTS", "Tên " + k.label() + " đã tồn tại");
        }
        actor.audit(audit, "Tạo", "Tạo " + k.label() + " " + name.trim());
        return new CatalogItem(id, name.trim(), 0);
    }

    public CatalogItem update(String path, UUID id, String name, HrActor actor) {
        Kind k = kind(path);
        int n;
        try {
            n = repo.rename(k, id, name.trim());
        } catch (DuplicateKeyException e) {
            throw BusinessException.conflict("NAME_EXISTS", "Tên " + k.label() + " đã tồn tại");
        }
        if (n == 0) {
            throw BusinessException.notFound("NOT_FOUND", "Không tìm thấy " + k.label());
        }
        actor.audit(audit, "Sửa", "Đổi tên " + k.label() + " thành " + name.trim());
        return repo.findAll(k).stream().filter(c -> c.id().equals(id)).findFirst().orElseThrow();
    }

    public void delete(String path, UUID id, HrActor actor) {
        Kind k = kind(path);
        if (repo.delete(k, id) > 0) {
            actor.audit(audit, "Xóa", "Xóa " + k.label());
        }
    }
}
