package com.vaxclinic.product.purchase;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import com.vaxclinic.product.purchase.SupplierCommandService.SupplierRequest;
import com.vaxclinic.product.purchase.SupplierListRepository.SupplierPage;
import com.vaxclinic.product.purchase.SupplierListRepository.SupplierRow;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

/**
 * Nhà cung cấp cho màn hình: tìm kiếm / chi tiết, ghi qua {@link SupplierCommandService} / {@link SupplierImportService}
 * (transaction riêng) rồi ghi lịch sử thao tác sau khi đã commit.
 */
@Service
public class SupplierManageService {

    private final SupplierCommandService commands;
    private final SupplierListRepository query;
    private final SupplierImportService importer;
    private final AuditLogger audit;

    public SupplierManageService(SupplierCommandService commands, SupplierListRepository query, SupplierImportService importer,
                                 AuditLogger audit) {
        this.commands = commands;
        this.query = query;
        this.importer = importer;
        this.audit = audit;
    }

    public SupplierPage search(SupplierListRepository.Filter filter) {
        return query.search(filter);
    }

    public SupplierRow get(UUID id) {
        return query.one(id);
    }

    public SupplierRow create(SupplierRequest req, Actor actor) {
        Supplier s = commands.create(req, actor);
        log(actor, "Thêm mới", s, "Tạo nhà cung cấp " + s.getCode() + " - " + s.getName());
        return query.one(s.getId());
    }

    public SupplierRow update(UUID id, SupplierRequest req, Actor actor) {
        Supplier s = commands.update(id, req);
        log(actor, "Sửa", s, "Sửa nhà cung cấp " + s.getCode() + " - " + s.getName());
        return query.one(id);
    }

    public SupplierRow setNote(UUID id, String note, Actor actor) {
        Supplier s = commands.setNote(id, note);
        log(actor, "Sửa", s, "Sửa ghi chú nhà cung cấp " + s.getCode());
        return query.one(id);
    }

    public SupplierRow setActive(UUID id, boolean active, Actor actor) {
        Supplier s = commands.setActive(id, active);
        log(actor, "Sửa", s, (active ? "Cho phép hoạt động" : "Ngừng hoạt động") + " nhà cung cấp " + s.getCode());
        return query.one(id);
    }

    public void delete(UUID id, Actor actor) {
        Supplier s = commands.delete(id);
        log(actor, "Xóa", s, "Xóa nhà cung cấp " + s.getCode() + " - " + s.getName());
    }

    /** Import file CSV / XLSX: cập nhật theo mã NCC, thêm mới nếu mã chưa có / để trống. Lỗi trả theo từng dòng. */
    public SupplierImportService.ImportResult importFile(MultipartFile file, Actor actor) {
        var result = importer.importFile(file, actor);
        audit.record(actor.id(), actor.name(), null, "Nhà cung cấp", "Import", null,
                "Import nhà cung cấp từ file " + file.getOriginalFilename() + ": thêm " + result.created() + ", cập nhật "
                        + result.updated() + ", lỗi " + result.errors().size());
        return result;
    }

    private void log(Actor actor, String action, Supplier s, String detail) {
        audit.record(actor.id(), actor.name(), s.getBranchId(), "Nhà cung cấp", action, s.getCode(), detail);
    }
}
