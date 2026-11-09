package com.vaxclinic.sales.customer;

import com.vaxclinic.common.address.AdminUnitCodes;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.common.SalesRules;
import com.vaxclinic.sales.customer.CustomerDtos.CustomerRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.vaxclinic.sales.common.Actor.blankToNull;

@Service
public class CustomerService {

    private final CustomerRepository customers;
    private final SalesRules rules;
    private final CustomerGroupRepository groups;

    public CustomerService(CustomerRepository customers, SalesRules rules, CustomerGroupRepository groups) {
        this.customers = customers;
        this.rules = rules;
        this.groups = groups;
    }

    @Transactional
    public Customer create(CustomerRequest req, Actor actor) {
        checkRequired(req);
        var c = new Customer();
        c.setId(UUID.randomUUID());
        String code = blankToNull(req.code());
        if (code == null) {
            c.setCode("KH%06d".formatted(customers.nextCodeNumber()));
        } else if (customers.existsByCodeIgnoreCase(code)) {
            throw BusinessException.conflict("CUSTOMER_CODE_EXISTS", "Mã khách hàng đã tồn tại");
        } else {
            c.setCode(code.toUpperCase());
        }
        c.setBranchId(req.branchId());
        c.setCreatedBy(actor.id());
        c.setCreatedByName(actor.name());
        apply(c, req);
        return customers.save(c);
    }

    @Transactional
    public Customer update(UUID id, CustomerRequest req) {
        checkRequired(req);
        var c = find(id);
        String code = blankToNull(req.code());
        if (code != null && !code.equalsIgnoreCase(c.getCode())) {
            if (customers.existsByCodeIgnoreCaseAndIdNot(code, id)) {
                throw BusinessException.conflict("CUSTOMER_CODE_EXISTS", "Mã khách hàng đã tồn tại");
            }
            c.setCode(code.toUpperCase());
        }
        apply(c, req);
        return c;
    }

    /** Thiết lập → Khách hàng → Thiết lập thông tin bắt buộc. */
    private void checkRequired(CustomerRequest r) {
        var rules = this.rules.settings().customer();
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("phone", blankToNull(r.phone()));
        values.put("email", blankToNull(r.email()));
        values.put("gender", blankToNull(r.gender()));
        values.put("birthday", r.birthday());
        values.put("address", blankToNull(r.address()));
        values.put("facebook", blankToNull(r.facebook()));
        values.put("group", r.groupId() != null ? r.groupId() : blankToNull(r.groupName()));
        List<String> missing = values.entrySet().stream()
                .filter(e -> rules.required(e.getKey()) && e.getValue() == null).map(e -> FIELD_LABELS.get(e.getKey())).toList();
        if (!missing.isEmpty()) {
            throw BusinessException.badRequest("CUSTOMER_FIELD_REQUIRED", "Bắt buộc nhập: " + String.join(", ", missing));
        }
    }

    private static final Map<String, String> FIELD_LABELS = Map.of("phone", "Số điện thoại", "email", "Email",
            "gender", "Giới tính", "birthday", "Ngày sinh", "address", "Địa chỉ", "facebook", "Facebook", "group", "Nhóm khách hàng");

    /** Tên các nhóm khách hàng (API cũ — danh sách đầy đủ ở /api/customer-groups). */
    public List<String> groupNames() {
        return customers.findGroupNames();
    }

    public Customer find(UUID id) {
        return customers.findById(id)
                .orElseThrow(() -> BusinessException.notFound("CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng"));
    }

    /** Nhóm: ưu tiên groupId; client cũ gửi groupName → tìm nhóm theo tên (không phân biệt hoa thường). */
    private void applyGroup(Customer c, CustomerRequest r) {
        String name = blankToNull(r.groupName());
        CustomerGroup g = r.groupId() != null
                ? groups.findById(r.groupId()).orElseThrow(() -> BusinessException.badRequest("GROUP_NOT_FOUND", "Nhóm khách hàng không tồn tại"))
                : name == null ? null : groups.findByNameIgnoreCase(name).orElseThrow(() ->
                        BusinessException.badRequest("GROUP_NOT_FOUND", "Nhóm khách hàng \"" + name + "\" không tồn tại"));
        c.setGroupId(g == null ? null : g.getId());
        c.setGroupName(g == null ? null : g.getName());
    }

    private void apply(Customer c, CustomerRequest r) {
        applyGroup(c, r);
        c.setName(r.name().trim());
        c.setPhone(blankToNull(r.phone()));
        c.setPhone2(blankToNull(r.phone2()));
        c.setEmail(blankToNull(r.email()));
        c.setFacebook(blankToNull(r.facebook()));
        c.setBirthday(r.birthday());
        c.setGender(blankToNull(r.gender()));
        c.setAddress(blankToNull(r.address()));
        c.setProvince(blankToNull(r.province()));
        c.setWard(blankToNull(r.ward()));
        c.setNote(r.note());
        c.setCustomerType("COMPANY".equals(r.customerType()) ? "COMPANY" : "PERSONAL");
        c.setBuyerName(blankToNull(r.buyerName()));
        c.setCompanyName(blankToNull(r.companyName()));
        c.setTaxCode(blankToNull(r.taxCode()));
        c.setInvoiceAddress(blankToNull(r.invoiceAddress()));
        c.setInvoiceProvince(blankToNull(r.invoiceProvince()));
        c.setInvoiceWard(blankToNull(r.invoiceWard()));
        c.setProvinceCode(AdminUnitCodes.clean(r.provinceCode()));
        c.setWardCode(AdminUnitCodes.clean(r.wardCode()));
        c.setInvoiceProvinceCode(AdminUnitCodes.clean(r.invoiceProvinceCode()));
        c.setInvoiceWardCode(AdminUnitCodes.clean(r.invoiceWardCode()));
        c.setIdNumber(blankToNull(r.idNumber()));
        c.setPassport(blankToNull(r.passport()));
        c.setInvoiceEmail(blankToNull(r.invoiceEmail()));
        c.setInvoicePhone(blankToNull(r.invoicePhone()));
        c.setBankName(blankToNull(r.bankName()));
        c.setBankAccount(blankToNull(r.bankAccount()));
    }
}
