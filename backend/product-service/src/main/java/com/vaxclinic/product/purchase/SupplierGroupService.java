package com.vaxclinic.product.purchase;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/** Nghiệp vụ nhóm nhà cung cấp: thêm / sửa (tên không trùng), xóa; ghi lịch sử thao tác trong transaction. */
@Service
public class SupplierGroupService {

    public record GroupRequest(@NotBlank(message = "Nhập tên nhóm") @Size(max = 100) String name, String note) {
    }

    public record GroupResponse(UUID id, String name, String note, long supplierCount) {
    }

    private final SupplierGroupRepository repo;
    private final AuditLogger audit;

    public SupplierGroupService(SupplierGroupRepository repo, AuditLogger audit) {
        this.repo = repo;
        this.audit = audit;
    }

    public List<GroupResponse> list() {
        return repo.list();
    }

    @Transactional
    public GroupResponse create(GroupRequest req, Actor actor) {
        String name = req.name().trim();
        checkUnique(name, null);
        UUID id = UUID.randomUUID();
        repo.insert(id, name, req.note());
        log(actor, "Thêm mới", "Tạo nhóm nhà cung cấp " + name);
        return new GroupResponse(id, name, req.note(), 0);
    }

    @Transactional
    public GroupResponse update(UUID id, GroupRequest req, Actor actor) {
        String name = req.name().trim();
        checkUnique(name, id);
        if (repo.update(id, name, req.note()) == 0) {
            throw notFound();
        }
        log(actor, "Sửa", "Sửa nhóm nhà cung cấp " + name);
        return list().stream().filter(g -> g.id().equals(id)).findFirst().orElseThrow();
    }

    /** Xóa nhóm: NCC trong nhóm chuyển về "Chưa có nhóm" (FK ON DELETE SET NULL). */
    @Transactional
    public void delete(UUID id, Actor actor) {
        List<String> names = repo.deleteReturningName(id);
        if (names.isEmpty()) {
            throw notFound();
        }
        log(actor, "Xóa", "Xóa nhóm nhà cung cấp " + names.get(0));
    }

    /** Dùng khi tạo NCC / import bằng tên nhóm: có thì lấy, chưa có thì tạo. */
    UUID findOrCreate(String name) {
        String n = name.trim();
        var found = repo.findIdsByName(n);
        if (!found.isEmpty()) {
            return found.get(0);
        }
        UUID id = UUID.randomUUID();
        repo.insert(id, n);
        return id;
    }

    void requireExists(UUID id) {
        if (id != null && repo.countById(id) == 0) {
            throw BusinessException.badRequest("SUPPLIER_GROUP_NOT_FOUND", "Nhóm nhà cung cấp không tồn tại");
        }
    }

    private void checkUnique(String name, UUID exceptId) {
        Long n = repo.countByNameExcept(name, exceptId == null ? new UUID(0, 0) : exceptId);
        if (n != null && n > 0) {
            throw BusinessException.conflict("SUPPLIER_GROUP_EXISTS", "Tên nhóm nhà cung cấp đã tồn tại");
        }
    }

    private static BusinessException notFound() {
        return BusinessException.notFound("SUPPLIER_GROUP_NOT_FOUND", "Không tìm thấy nhóm nhà cung cấp");
    }

    private void log(Actor actor, String action, String detail) {
        audit.record(actor.id(), actor.name(), null, "Nhà cung cấp", action, null, detail);
    }
}
