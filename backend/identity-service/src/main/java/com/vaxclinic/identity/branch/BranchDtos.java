package com.vaxclinic.identity.branch;

import com.vaxclinic.common.address.AdminUnitCodes;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/** Request / response của màn Điểm tiêm (/api/branches). */
public final class BranchDtos {

    private BranchDtos() {
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
}
