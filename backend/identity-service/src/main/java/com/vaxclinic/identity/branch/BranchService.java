package com.vaxclinic.identity.branch;

import com.vaxclinic.common.address.AdminUnitCodes;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.branch.BranchDtos.BranchRequest;
import com.vaxclinic.identity.branch.BranchDtos.BranchResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/** CRUD điểm tiêm. */
@Service
public class BranchService {

    private final BranchRepository branches;
    private final BranchUserCountRepository userCounts;

    public BranchService(BranchRepository branches, BranchUserCountRepository userCounts) {
        this.branches = branches;
        this.userCounts = userCounts;
    }

    public List<BranchResponse> list() {
        var counts = userCounts.activeUserCounts();
        return branches.findAllByOrderByCodeAsc().stream()
                .map(b -> BranchResponse.of(b, counts.getOrDefault(b.getId(), 0))).toList();
    }

    @Transactional
    public BranchResponse create(BranchRequest req) {
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

    @Transactional
    public BranchResponse update(UUID id, BranchRequest req) {
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
