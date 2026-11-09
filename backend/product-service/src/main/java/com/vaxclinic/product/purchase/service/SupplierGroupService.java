package com.vaxclinic.product.purchase.service;

import com.vaxclinic.product.purchase.dto.SupplierGroupDtos;
import com.vaxclinic.product.purchase.repository.SupplierGroupRepository;
import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.purchase.dto.SupplierGroupDtos.GroupRequest;
import com.vaxclinic.product.purchase.dto.SupplierGroupDtos.GroupResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/** Nhóm nhà cung cấp: thêm/sửa/xóa (kèm nhật ký trong cùng transaction), tìm hoặc tạo theo tên khi ghi NCC. */
@Service
public class SupplierGroupService {

    private final SupplierGroupRepository groups;
    private final AuditLogger audit;

    public SupplierGroupService(SupplierGroupRepository groups, AuditLogger audit) {
        this.groups = groups;
        this.audit = audit;
    }

    public List<GroupResponse> list() {
        return groups.list();
    }

    @Transactional
    public GroupResponse create(GroupRequest req, Jwt jwt) {
        String name = req.name().trim();
        checkUnique(name, null);
        UUID id = UUID.randomUUID();
        groups.insert(id, name, req.note());
        log(jwt, "Thêm mới", "Tạo nhóm nhà cung cấp " + name);
        return new GroupResponse(id, name, req.note(), 0);
    }

    @Transactional
    public GroupResponse update(UUID id, GroupRequest req, Jwt jwt) {
        String name = req.name().trim();
        checkUnique(name, id);
        if (groups.update(id, name, req.note()) == 0) {
            throw notFound();
        }
        log(jwt, "Sửa", "Sửa nhóm nhà cung cấp " + name);
        return list().stream().filter(g -> g.id().equals(id)).findFirst().orElseThrow();
    }

    /** Xóa nhóm: NCC trong nhóm chuyển về "Chưa có nhóm" (FK ON DELETE SET NULL). */
    @Transactional
    public void delete(UUID id, Jwt jwt) {
        List<String> names = groups.deleteReturningName(id);
        if (names.isEmpty()) {
            throw notFound();
        }
        log(jwt, "Xóa", "Xóa nhóm nhà cung cấp " + names.get(0));
    }

    /**
     * Dùng khi tạo NCC / import bằng tên nhóm: có thì lấy, chưa có thì tạo.
     * Giữ quyền catalog.view như khi hàm này còn nằm trên SupplierGroupController (@PreAuthorize cấp class).
     */
    @PreAuthorize("hasAuthority('catalog.view')")
    public UUID findOrCreate(String name) {
        String n = name.trim();
        var found = groups.findIdsByName(n);
        if (!found.isEmpty()) {
            return found.get(0);
        }
        UUID id = UUID.randomUUID();
        groups.insertName(id, n);
        return id;
    }

    /** Giữ quyền catalog.view như khi hàm này còn nằm trên SupplierGroupController (@PreAuthorize cấp class). */
    @PreAuthorize("hasAuthority('catalog.view')")
    public void requireExists(UUID id) {
        if (id != null && groups.countById(id) == 0) {
            throw BusinessException.badRequest("SUPPLIER_GROUP_NOT_FOUND", "Nhóm nhà cung cấp không tồn tại");
        }
    }

    private void checkUnique(String name, UUID exceptId) {
        Long n = groups.countByNameExcept(name, exceptId == null ? new UUID(0, 0) : exceptId);
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
