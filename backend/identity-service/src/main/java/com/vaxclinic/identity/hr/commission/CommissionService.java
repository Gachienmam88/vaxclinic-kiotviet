package com.vaxclinic.identity.hr.commission;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.hr.HrActor;
import com.vaxclinic.identity.hr.commission.CommissionModels.RuleItem;
import com.vaxclinic.identity.hr.commission.CommissionModels.Rule;
import com.vaxclinic.identity.hr.commission.CommissionModels.Table;
import com.vaxclinic.identity.hr.commission.CommissionModels.TableRequest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Bảng hoa hồng: tên không trùng, mức % không quá 100%, mỗi nhân viên áp dụng tối đa 1 bảng. Mỗi thay đổi ghi Lịch sử thao tác.
 */
@Service
public class CommissionService {

    private final CommissionRepository repo;
    private final AuditLogger audit;

    public CommissionService(CommissionRepository repo, AuditLogger audit) {
        this.repo = repo;
        this.audit = audit;
    }

    public List<Table> list() {
        return repo.findAll();
    }

    public List<Rule> rules() {
        return repo.findAllRules();
    }

    public Table create(TableRequest req, HrActor actor) {
        UUID id = UUID.randomUUID();
        try {
            repo.insert(id, req.name().trim(), req.active() == null || req.active());
        } catch (DuplicateKeyException e) {
            throw BusinessException.conflict("NAME_EXISTS", "Tên bảng hoa hồng đã tồn tại");
        }
        actor.audit(audit, "Tạo", "Tạo bảng hoa hồng " + req.name().trim());
        return find(id);
    }

    public Table update(UUID id, TableRequest req, HrActor actor) {
        try {
            if (repo.update(id, req.name().trim(), req.active() == null || req.active()) == 0) {
                throw BusinessException.notFound("TABLE_NOT_FOUND", "Không tìm thấy bảng hoa hồng");
            }
        } catch (DuplicateKeyException e) {
            throw BusinessException.conflict("NAME_EXISTS", "Tên bảng hoa hồng đã tồn tại");
        }
        actor.audit(audit, "Sửa", "Cập nhật bảng hoa hồng " + req.name().trim());
        return find(id);
    }

    public void delete(UUID id, HrActor actor) {
        Table t = find(id);
        repo.delete(id);
        actor.audit(audit, "Xóa", "Xóa bảng hoa hồng " + t.name());
    }

    /** Áp theo nhóm hàng: màn hình gửi mức cho toàn bộ mặt hàng của nhóm; value null → bỏ mức của mặt hàng. */
    @Transactional
    public Table saveRules(UUID id, List<RuleItem> items, HrActor actor) {
        Table t = find(id);
        for (RuleItem it : items) {
            if (it.value() == null) {
                repo.deleteRule(id, it.productId());
                continue;
            }
            String type = it.rateType() == null ? "PERCENT" : it.rateType();
            if ("PERCENT".equals(type) && it.value().compareTo(BigDecimal.valueOf(100)) > 0) {
                throw BusinessException.badRequest("INVALID_RATE", "Hoa hồng theo % không được vượt quá 100%");
            }
            repo.upsertRule(id, it.productId(), type, it.value());
        }
        actor.audit(audit, "Sửa", "Cập nhật " + items.size() + " mức hoa hồng của bảng " + t.name());
        return find(id);
    }

    public List<UUID> employees(UUID id) {
        return repo.employeeIds(id);
    }

    /** Đặt danh sách nhân viên áp dụng bảng (nhân viên khác đang dùng bảng này sẽ bỏ áp dụng). */
    @Transactional
    public Table saveEmployees(UUID id, List<UUID> employeeIds, HrActor actor) {
        Table t = find(id);
        repo.clearEmployees(id);
        employeeIds.forEach(e -> repo.assignEmployee(id, e));
        actor.audit(audit, "Sửa", "Áp dụng bảng hoa hồng " + t.name() + " cho " + employeeIds.size() + " nhân viên");
        return find(id);
    }

    private Table find(UUID id) {
        return repo.findAll().stream().filter(t -> t.id().equals(id)).findFirst()
                .orElseThrow(() -> BusinessException.notFound("TABLE_NOT_FOUND", "Không tìm thấy bảng hoa hồng"));
    }
}
