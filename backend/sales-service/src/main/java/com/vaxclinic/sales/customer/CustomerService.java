package com.vaxclinic.sales.customer;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.customer.CustomerDtos.CustomerRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static com.vaxclinic.sales.common.Actor.blankToNull;

@Service
public class CustomerService {

    private final CustomerRepository customers;

    public CustomerService(CustomerRepository customers) {
        this.customers = customers;
    }

    @Transactional
    public Customer create(CustomerRequest req, Actor actor) {
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

    public Customer find(UUID id) {
        return customers.findById(id)
                .orElseThrow(() -> BusinessException.notFound("CUSTOMER_NOT_FOUND", "Không tìm thấy khách hàng"));
    }

    private static void apply(Customer c, CustomerRequest r) {
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
        c.setGroupName(blankToNull(r.groupName()));
        c.setNote(r.note());
        c.setCustomerType("COMPANY".equals(r.customerType()) ? "COMPANY" : "PERSONAL");
        c.setBuyerName(blankToNull(r.buyerName()));
        c.setCompanyName(blankToNull(r.companyName()));
        c.setTaxCode(blankToNull(r.taxCode()));
        c.setInvoiceAddress(blankToNull(r.invoiceAddress()));
        c.setInvoiceProvince(blankToNull(r.invoiceProvince()));
        c.setInvoiceWard(blankToNull(r.invoiceWard()));
        c.setIdNumber(blankToNull(r.idNumber()));
        c.setPassport(blankToNull(r.passport()));
        c.setInvoiceEmail(blankToNull(r.invoiceEmail()));
        c.setInvoicePhone(blankToNull(r.invoicePhone()));
        c.setBankName(blankToNull(r.bankName()));
        c.setBankAccount(blankToNull(r.bankAccount()));
    }
}
