package com.vaxclinic.identity.branch;

import com.vaxclinic.common.address.AdminUnitCodes;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/** DTO của màn hình chi nhánh / điểm tiêm. */
public final class BranchModels {

    private BranchModels() {
    }

    public record BranchRequest(@NotBlank @Size(max = 20) String code,
                                @NotBlank @Size(max = 200) String name,
                                @Size(max = 500) String address,
                                @Size(max = 20) String phone,
                                boolean active,
                                @Size(max = 100) String province, @Size(max = 100) String ward,
                                @Pattern(regexp = AdminUnitCodes.PROVINCE, message = AdminUnitCodes.PROVINCE_MSG) String provinceCode,
                                @Pattern(regexp = AdminUnitCodes.WARD, message = AdminUnitCodes.WARD_MSG) String wardCode) {
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
}
