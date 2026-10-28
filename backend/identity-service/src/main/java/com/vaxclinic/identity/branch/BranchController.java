package com.vaxclinic.identity.branch;

import com.vaxclinic.common.address.AdminUnitCodes;
import com.vaxclinic.common.error.BusinessException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** CRUD điểm tiêm. Mọi user đăng nhập được xem; chỉ quyền branch.manage được sửa. */
@RestController
@RequestMapping("/api/branches")
public class BranchController {

    private final BranchRepository branches;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    public BranchController(BranchRepository branches, org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.branches = branches;
        this.jdbc = jdbc;
    }

    public record BranchRequest(@NotBlank @Size(max = 20) String code,
                                @NotBlank @Size(max = 200) String name,
                                @Size(max = 500) String address,
                                @Size(max = 20) String phone,
                                boolean active,
                                @Size(max = 100) String province, @Size(max = 100) String ward,
                                @jakarta.validation.constraints.Pattern(regexp = AdminUnitCodes.PROVINCE, message = AdminUnitCodes.PROVINCE_MSG) String provinceCode,
                                @jakarta.validation.constraints.Pattern(regexp = AdminUnitCodes.WARD, message = AdminUnitCodes.WARD_MSG) String wardCode) {
    }

    /** userCount: số tài khoản đang hoạt động được làm việc tại điểm tiêm (cột "SL người dùng"). */
    public record BranchResponse(UUID id, String code, String name, String address, String phone, boolean active,
                                 int userCount, String province, String ward, String provinceCode, String wardCode) {
        static BranchResponse of(Branch b) {
            return of(b, 0);
        }

        static BranchResponse of(Branch b, int userCount) {
            return new BranchResponse(b.getId(), b.getCode(), b.getName(), b.getAddress(), b.getPhone(), b.isActive(), userCount,
                    b.getProvince(), b.getWard(), b.getProvinceCode(), b.getWardCode());
        }
    }

    @GetMapping
    public List<BranchResponse> list() {
        var counts = new java.util.HashMap<UUID, Integer>();
        jdbc.query("select ub.branch_id, count(*) from user_branches ub join users u on u.id = ub.user_id where u.active group by ub.branch_id",
                rs -> { counts.put(rs.getObject(1, UUID.class), rs.getInt(2)); });
        return branches.findAllByOrderByCodeAsc().stream()
                .map(b -> BranchResponse.of(b, counts.getOrDefault(b.getId(), 0))).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('branch.manage')")
    @Transactional
    public BranchResponse create(@Valid @RequestBody BranchRequest req) {
        String code = req.code().trim().toUpperCase();
        if (branches.existsByCode(code)) {
            throw BusinessException.conflict("BRANCH_CODE_EXISTS", "Mã chi nhánh đã tồn tại");
        }
        var b = new Branch();
        b.setId(UUID.randomUUID());
        b.setCode(code);
        apply(b, req);
        return BranchResponse.of(branches.save(b));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('branch.manage')")
    @Transactional
    public BranchResponse update(@PathVariable UUID id, @Valid @RequestBody BranchRequest req) {
        var b = branches.findById(id)
                .orElseThrow(() -> BusinessException.notFound("BRANCH_NOT_FOUND", "Không tìm thấy chi nhánh"));
        apply(b, req);
        return BranchResponse.of(b);
    }

    // Code is immutable after creation: other services store it on documents.
    private void apply(Branch b, BranchRequest req) {
        b.setName(req.name().trim());
        b.setAddress(req.address());
        b.setPhone(req.phone());
        b.setProvince(blankToNull(req.province()));
        b.setWard(blankToNull(req.ward()));
        b.setProvinceCode(AdminUnitCodes.clean(req.provinceCode()));
        b.setWardCode(AdminUnitCodes.clean(req.wardCode()));
        b.setActive(req.active());
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
