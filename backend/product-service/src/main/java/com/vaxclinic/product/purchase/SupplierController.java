package com.vaxclinic.product.purchase;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.web.PageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Nhà cung cấp: xem cần catalog.view, thêm/sửa cần inventory.manage (thủ kho, quản lý). */
@RestController
@RequestMapping("/api/suppliers")
@PreAuthorize("hasAuthority('catalog.view')")
public class SupplierController {

    private final SupplierRepository suppliers;

    public SupplierController(SupplierRepository suppliers) {
        this.suppliers = suppliers;
    }

    public record SupplierRequest(@NotBlank(message = "Nhập tên nhà cung cấp") @Size(max = 250) String name,
                                  @Size(max = 30) String code, @Size(max = 20) String phone,
                                  @Email(message = "Email không hợp lệ") @Size(max = 150) String email,
                                  @Size(max = 500) String address, @Size(max = 100) String province,
                                  @Size(max = 100) String ward, @Size(max = 100) String groupName, String note,
                                  @Size(max = 250) String companyName, @Size(max = 20) String taxCode,
                                  @Size(max = 20) String idNumber, Boolean active) {
    }

    public record SupplierResponse(UUID id, String code, String name, String phone, String email, String address,
                                   String province, String ward, String groupName, String note, String companyName,
                                   String taxCode, String idNumber, boolean active) {
        static SupplierResponse of(Supplier s) {
            return new SupplierResponse(s.getId(), s.getCode(), s.getName(), s.getPhone(), s.getEmail(),
                    s.getAddress(), s.getProvince(), s.getWard(), s.getGroupName(), s.getNote(), s.getCompanyName(),
                    s.getTaxCode(), s.getIdNumber(), s.isActive());
        }
    }

    @GetMapping
    public PageResponse<SupplierResponse> search(@RequestParam(defaultValue = "") String q,
                                                 @RequestParam(required = false) String groupName,
                                                 @RequestParam(required = false) Boolean active,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "15") int size) {
        var pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        return PageResponse.from(suppliers.search(q.trim(), groupName, active, pageable), SupplierResponse::of);
    }

    @GetMapping("/groups")
    public List<String> groups() {
        return suppliers.findGroupNames();
    }

    @GetMapping("/{id}")
    public SupplierResponse get(@PathVariable UUID id) {
        return SupplierResponse.of(find(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('inventory.manage')")
    @Transactional
    public SupplierResponse create(@Valid @RequestBody SupplierRequest req) {
        var s = new Supplier();
        s.setId(UUID.randomUUID());
        if (req.code() == null || req.code().isBlank()) {
            s.setCode("NCC%06d".formatted(suppliers.nextCodeNumber()));
        } else if (suppliers.existsByCodeIgnoreCase(req.code().trim())) {
            throw BusinessException.conflict("SUPPLIER_CODE_EXISTS", "Mã nhà cung cấp đã tồn tại");
        } else {
            s.setCode(req.code().trim().toUpperCase());
        }
        apply(s, req);
        return SupplierResponse.of(suppliers.save(s));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('inventory.manage')")
    @Transactional
    public SupplierResponse update(@PathVariable UUID id, @Valid @RequestBody SupplierRequest req) {
        var s = find(id);
        if (req.code() != null && !req.code().isBlank()) {
            String code = req.code().trim().toUpperCase();
            if (suppliers.existsByCodeIgnoreCaseAndIdNot(code, id)) {
                throw BusinessException.conflict("SUPPLIER_CODE_EXISTS", "Mã nhà cung cấp đã tồn tại");
            }
            s.setCode(code);
        }
        apply(s, req);
        return SupplierResponse.of(s);
    }

    private Supplier find(UUID id) {
        return suppliers.findById(id)
                .orElseThrow(() -> BusinessException.notFound("SUPPLIER_NOT_FOUND", "Không tìm thấy nhà cung cấp"));
    }

    private static void apply(Supplier s, SupplierRequest r) {
        s.setName(r.name().trim());
        s.setPhone(trim(r.phone()));
        s.setEmail(trim(r.email()));
        s.setAddress(trim(r.address()));
        s.setProvince(trim(r.province()));
        s.setWard(trim(r.ward()));
        s.setGroupName(trim(r.groupName()));
        s.setNote(r.note());
        s.setCompanyName(trim(r.companyName()));
        s.setTaxCode(trim(r.taxCode()));
        s.setIdNumber(trim(r.idNumber()));
        if (r.active() != null) {
            s.setActive(r.active());
        }
    }

    private static String trim(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
