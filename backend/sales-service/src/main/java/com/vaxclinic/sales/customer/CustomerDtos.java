package com.vaxclinic.sales.customer;

import com.vaxclinic.common.address.AdminUnitCodes;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class CustomerDtos {

    private CustomerDtos() {
    }

    public record CustomerRequest(
            @Size(max = 30) String code,
            @NotBlank(message = "Nhập tên khách hàng") @Size(max = 200) String name,
            @Size(max = 20) String phone, @Size(max = 20) String phone2,
            @Email(message = "Email không hợp lệ") @Size(max = 150) String email,
            @Size(max = 200) String facebook, LocalDate birthday,
            @Pattern(regexp = "MALE|FEMALE", message = "Giới tính không hợp lệ") String gender,
            @Size(max = 500) String address, @Size(max = 100) String province, @Size(max = 100) String ward,
            @Size(max = 100) String groupName, String note,
            @Pattern(regexp = "PERSONAL|COMPANY") String customerType,
            @Size(max = 200) String buyerName, @Size(max = 250) String companyName, @Size(max = 20) String taxCode,
            @Size(max = 500) String invoiceAddress, @Size(max = 100) String invoiceProvince,
            @Size(max = 100) String invoiceWard, @Size(max = 20) String idNumber, @Size(max = 20) String passport,
            @Email(message = "Email xuất hóa đơn không hợp lệ") @Size(max = 150) String invoiceEmail,
            @Size(max = 20) String invoicePhone, @Size(max = 150) String bankName, @Size(max = 50) String bankAccount,
            UUID branchId, UUID groupId,
            @Pattern(regexp = AdminUnitCodes.PROVINCE, message = AdminUnitCodes.PROVINCE_MSG) String provinceCode,
            @Pattern(regexp = AdminUnitCodes.WARD, message = AdminUnitCodes.WARD_MSG) String wardCode,
            @Pattern(regexp = AdminUnitCodes.PROVINCE, message = AdminUnitCodes.PROVINCE_MSG) String invoiceProvinceCode,
            @Pattern(regexp = AdminUnitCodes.WARD, message = AdminUnitCodes.WARD_MSG) String invoiceWardCode) {
    }

    public record CustomerResponse(UUID id, String code, String name, String phone, String phone2, String email,
                                   String facebook, LocalDate birthday, String gender, String address,
                                   String province, String ward, UUID groupId, String groupName, String note,
                                   String customerType,
                                   String buyerName, String companyName, String taxCode, String invoiceAddress,
                                   String invoiceProvince, String invoiceWard, String idNumber, String passport,
                                   String invoiceEmail, String invoicePhone, String bankName, String bankAccount,
                                   BigDecimal debt, BigDecimal totalSales, BigDecimal totalReturns, UUID branchId,
                                   String createdByName, Instant createdAt, boolean active, String provinceCode,
                                   String wardCode, String invoiceProvinceCode, String invoiceWardCode) {
        public static CustomerResponse of(Customer c) {
            return new CustomerResponse(c.getId(), c.getCode(), c.getName(), c.getPhone(), c.getPhone2(),
                    c.getEmail(), c.getFacebook(), c.getBirthday(), c.getGender(), c.getAddress(), c.getProvince(),
                    c.getWard(), c.getGroupId(), c.getGroupName(), c.getNote(), c.getCustomerType(), c.getBuyerName(),
                    c.getCompanyName(), c.getTaxCode(), c.getInvoiceAddress(), c.getInvoiceProvince(),
                    c.getInvoiceWard(), c.getIdNumber(), c.getPassport(), c.getInvoiceEmail(), c.getInvoicePhone(),
                    c.getBankName(), c.getBankAccount(), c.getDebt(), c.getTotalSales(), c.getTotalReturns(),
                    c.getBranchId(), c.getCreatedByName(), c.getCreatedAt(), c.isActive(), c.getProvinceCode(),
                    c.getWardCode(), c.getInvoiceProvinceCode(), c.getInvoiceWardCode());
        }
    }

    /** groupDiscountType/Value: giảm giá của nhóm — màn bán hàng lưu cùng khách để tự điền giảm giá cả khi mất mạng. */
    public record CustomerListItem(UUID id, String code, String name, String phone, UUID groupId, String groupName,
                                   String groupDiscountType, BigDecimal groupDiscountValue,
                                   BigDecimal debt, BigDecimal totalSales, BigDecimal netSales) {
    }

    public record CustomerListResponse(List<CustomerListItem> items, long total, int page, int size,
                                       BigDecimal sumDebt, BigDecimal sumSales, BigDecimal sumNetSales) {
    }
}
