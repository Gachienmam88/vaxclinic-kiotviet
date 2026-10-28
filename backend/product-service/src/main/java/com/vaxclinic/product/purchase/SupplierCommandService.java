package com.vaxclinic.product.purchase;

import com.vaxclinic.common.address.AdminUnitCodes;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** Ghi NCC: tạo / sửa (mã tự sinh NCCxxxxxx), ghi chú nhanh, ngừng / cho phép hoạt động, xóa khi chưa có giao dịch. */
@Service
public class SupplierCommandService {

    /** groupId ưu tiên; groupName (tương thích cũ, import) → tìm hoặc tạo nhóm theo tên. */
    public record SupplierRequest(@NotBlank(message = "Nhập tên nhà cung cấp") @Size(max = 250) String name,
                                  @Size(max = 30) String code, @Size(max = 20) String phone,
                                  @Email(message = "Email không hợp lệ") @Size(max = 150) String email,
                                  @Size(max = 500) String address, @Size(max = 100) String province,
                                  @Size(max = 100) String ward, UUID groupId, @Size(max = 100) String groupName,
                                  String note, @Size(max = 250) String companyName, @Size(max = 20) String taxCode,
                                  @Size(max = 20) String idNumber, Boolean active,
                                  @Pattern(regexp = AdminUnitCodes.PROVINCE, message = AdminUnitCodes.PROVINCE_MSG) String provinceCode,
                                  @Pattern(regexp = AdminUnitCodes.WARD, message = AdminUnitCodes.WARD_MSG) String wardCode) {
    }

    private final SupplierRepository suppliers;
    private final SupplierGroupController groups;
    private final JdbcTemplate jdbc;

    public SupplierCommandService(SupplierRepository suppliers, SupplierGroupController groups, JdbcTemplate jdbc) {
        this.suppliers = suppliers;
        this.groups = groups;
        this.jdbc = jdbc;
    }

    @Transactional
    public Supplier create(SupplierRequest req, Actor actor) {
        var s = new Supplier();
        s.setId(UUID.randomUUID());
        String code = PurchaseLineSupport.blankToNull(req.code());
        if (code == null) {
            s.setCode("NCC%06d".formatted(suppliers.nextCodeNumber()));
        } else if (suppliers.existsByCodeIgnoreCase(code)) {
            throw BusinessException.conflict("SUPPLIER_CODE_EXISTS", "Mã nhà cung cấp đã tồn tại");
        } else {
            s.setCode(code.toUpperCase());
        }
        s.setCreatedBy(actor.id());
        s.setCreatedByName(actor.name());
        s.setBranchId(actor.branchIds().isEmpty() ? null : UUID.fromString(actor.branchIds().get(0)));
        apply(s, req);
        return suppliers.saveAndFlush(s);
    }

    @Transactional
    public Supplier update(UUID id, SupplierRequest req) {
        var s = find(id);
        String code = PurchaseLineSupport.blankToNull(req.code());
        if (code != null) {
            if (suppliers.existsByCodeIgnoreCaseAndIdNot(code, id)) {
                throw BusinessException.conflict("SUPPLIER_CODE_EXISTS", "Mã nhà cung cấp đã tồn tại");
            }
            s.setCode(code.toUpperCase());
        }
        apply(s, req);
        return suppliers.saveAndFlush(s);
    }

    @Transactional
    public Supplier setNote(UUID id, String note) {
        var s = find(id);
        s.setNote(PurchaseLineSupport.blankToNull(note));
        return s;
    }

    @Transactional
    public Supplier setActive(UUID id, boolean active) {
        var s = find(id);
        s.setActive(active);
        return s;
    }

    /** Xóa chỉ khi NCC chưa có giao dịch nào (kể cả phiếu tạm / đã hủy); ngược lại gợi ý ngừng hoạt động. */
    @Transactional
    public Supplier delete(UUID id) {
        var s = find(id);
        Long used = jdbc.queryForObject("""
                select (select count(*) from purchase_receipts where supplier_id = ?)
                     + (select count(*) from purchase_returns where supplier_id = ?)
                     + (select count(*) from supplier_debt_docs where supplier_id = ?)""", Long.class, id, id, id);
        if (used != null && used > 0) {
            throw BusinessException.badRequest("SUPPLIER_HAS_TRANSACTIONS",
                    "Nhà cung cấp đã có giao dịch, không thể xóa. Hãy chọn Ngừng hoạt động để không dùng nhà cung cấp này nữa");
        }
        suppliers.delete(s);
        return s;
    }

    Supplier find(UUID id) {
        return suppliers.findById(id)
                .orElseThrow(() -> BusinessException.notFound("SUPPLIER_NOT_FOUND", "Không tìm thấy nhà cung cấp"));
    }

    void apply(Supplier s, SupplierRequest r) {
        s.setName(r.name().trim());
        s.setPhone(PurchaseLineSupport.blankToNull(r.phone()));
        s.setEmail(PurchaseLineSupport.blankToNull(r.email()));
        s.setAddress(PurchaseLineSupport.blankToNull(r.address()));
        s.setProvince(PurchaseLineSupport.blankToNull(r.province()));
        s.setWard(PurchaseLineSupport.blankToNull(r.ward()));
        s.setProvinceCode(AdminUnitCodes.clean(r.provinceCode()));
        s.setWardCode(AdminUnitCodes.clean(r.wardCode()));
        if (r.groupId() != null) {
            groups.requireExists(r.groupId());
            s.setGroupId(r.groupId());
        } else {
            String g = PurchaseLineSupport.blankToNull(r.groupName());
            s.setGroupId(g == null ? null : groups.findOrCreate(g));
        }
        s.setNote(PurchaseLineSupport.blankToNull(r.note()));
        s.setCompanyName(PurchaseLineSupport.blankToNull(r.companyName()));
        s.setTaxCode(PurchaseLineSupport.blankToNull(r.taxCode()));
        s.setIdNumber(PurchaseLineSupport.blankToNull(r.idNumber()));
        if (r.active() != null) {
            s.setActive(r.active());
        }
    }
}
