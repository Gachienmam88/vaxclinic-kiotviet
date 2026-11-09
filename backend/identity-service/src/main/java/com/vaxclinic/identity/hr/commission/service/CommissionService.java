package com.vaxclinic.identity.hr.commission.service;

import com.vaxclinic.identity.hr.commission.repository.CommissionRepository;
import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.hr.dto.HrActor;
import com.vaxclinic.identity.hr.commission.dto.CommissionDtos.EmployeesRequest;
import com.vaxclinic.identity.hr.commission.dto.CommissionDtos.Rule;
import com.vaxclinic.identity.hr.commission.dto.CommissionDtos.RuleItem;
import com.vaxclinic.identity.hr.commission.dto.CommissionDtos.RulesRequest;
import com.vaxclinic.identity.hr.commission.dto.CommissionDtos.Table;
import com.vaxclinic.identity.hr.commission.dto.CommissionDtos.TableRequest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Bảng hoa hồng: mỗi bảng có mức hoa hồng theo mặt hàng (% doanh thu hoặc số tiền / 1 đơn vị bán) và danh sách nhân viên áp dụng.
 * Áp theo nhóm hàng: màn hình gửi mức cho toàn bộ mặt hàng của nhóm.
 */
@Service
public class CommissionService {

    private final CommissionRepository commissions;
    private final AuditLogger audit;

    public CommissionService(CommissionRepository commissions, AuditLogger audit) {
        this.commissions = commissions;
        this.audit = audit;
    }

    public List<Table> list() {
        return commissions.tables();
    }

    public List<Rule> rules() {
        return commissions.rules();
    }

    public Table create(TableRequest req, HrActor actor) {
        UUID id = UUID.randomUUID();
        try {
            commissions.insertTable(id, req.name().trim(), req.active() == null || req.active());
        } catch (DuplicateKeyException e) {
            throw BusinessException.conflict("NAME_EXISTS", "Tên bảng hoa hồng đã tồn tại");
        }
        actor.audit(audit, "Tạo", "Tạo bảng hoa hồng " + req.name().trim());
        return find(id);
    }

    public Table update(UUID id, TableRequest req, HrActor actor) {
        try {
            if (commissions.updateTable(id, req.name().trim(), req.active() == null || req.active()) == 0) {
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
        commissions.deleteTable(id);
        actor.audit(audit, "Xóa", "Xóa bảng hoa hồng " + t.name());
    }

    @Transactional
    public Table saveRules(UUID id, RulesRequest req, HrActor actor) {
        Table t = find(id);
        for (RuleItem it : req.items()) {
            if (it.value() == null) {
                commissions.deleteRule(id, it.productId());
                continue;
            }
            String type = it.rateType() == null ? "PERCENT" : it.rateType();
            if ("PERCENT".equals(type) && it.value().compareTo(BigDecimal.valueOf(100)) > 0) {
                throw BusinessException.badRequest("INVALID_RATE", "Hoa hồng theo % không được vượt quá 100%");
            }
            commissions.upsertRule(id, it.productId(), type, it.value());
        }
        actor.audit(audit, "Sửa", "Cập nhật " + req.items().size() + " mức hoa hồng của bảng " + t.name());
        return find(id);
    }

    public List<UUID> employees(UUID id) {
        return commissions.employeeIds(id);
    }

    /** Đặt danh sách nhân viên áp dụng bảng (nhân viên khác đang dùng bảng này sẽ bỏ áp dụng). */
    @Transactional
    public Table saveEmployees(UUID id, EmployeesRequest req, HrActor actor) {
        Table t = find(id);
        commissions.clearEmployees(id);
        req.employeeIds().forEach(e -> commissions.assignEmployee(id, e));
        actor.audit(audit, "Sửa", "Áp dụng bảng hoa hồng " + t.name() + " cho " + req.employeeIds().size() + " nhân viên");
        return find(id);
    }

    private Table find(UUID id) {
        return list().stream().filter(t -> t.id().equals(id)).findFirst()
                .orElseThrow(() -> BusinessException.notFound("TABLE_NOT_FOUND", "Không tìm thấy bảng hoa hồng"));
    }
}
