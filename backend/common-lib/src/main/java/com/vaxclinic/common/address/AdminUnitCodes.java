package com.vaxclinic.common.address;

/**
 * Định dạng mã đơn vị hành chính 2 cấp (sau sắp xếp 01/07/2025, theo danh mục Cục Thống kê): tỉnh/thành phố 2 chữ số,
 * phường/xã/đặc khu 5 chữ số. Backend chỉ kiểm tra hình thức (không giữ danh mục); chuỗi rỗng = chưa chọn.
 * Dùng: {@code @Pattern(regexp = AdminUnitCodes.PROVINCE, message = AdminUnitCodes.PROVINCE_MSG)}.
 */
public final class AdminUnitCodes {

    public static final String PROVINCE = "([0-9]{2})?";
    public static final String WARD = "([0-9]{5})?";
    public static final String PROVINCE_MSG = "Mã tỉnh/thành phố phải gồm 2 chữ số";
    public static final String WARD_MSG = "Mã phường/xã phải gồm 5 chữ số";

    private AdminUnitCodes() {
    }

    /** Địa chỉ đầy đủ để hiển thị / in: "số nhà, đường, Phường/Xã, Tỉnh/Thành phố" (bỏ phần trống); null nếu trống hết. */
    public static String joinAddress(String... parts) {
        String s = java.util.Arrays.stream(parts).filter(p -> p != null && !p.isBlank()).map(String::trim)
                .collect(java.util.stream.Collectors.joining(", "));
        return s.isEmpty() ? null : s;
    }

    /** "" / khoảng trắng → null để lưu NULL. */
    public static String clean(String code) {
        return code == null || code.isBlank() ? null : code.trim();
    }
}
