package com.vaxclinic.sales.customer;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.customer.CustomerDebtRepository.DebtLine;
import com.vaxclinic.sales.customer.CustomerDtos.CustomerListResponse;
import com.vaxclinic.sales.customer.CustomerDtos.CustomerRequest;
import com.vaxclinic.sales.customer.CustomerDtos.CustomerResponse;
import com.vaxclinic.sales.debt.DebtService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Khách hàng cho màn hình: danh sách / chi tiết / sổ nợ, thêm / sửa ({@link CustomerService}), thu nợ / chiết khấu /
 * điều chỉnh nợ ({@link DebtService}). Ghi lịch sử thao tác sau khi transaction nghiệp vụ đã commit.
 */
@Service
public class CustomerManageService {

    private final CustomerService service;
    private final CustomerListQuery listQuery;
    private final CustomerRepository customers;
    private final CustomerDebtRepository debts;
    private final DebtService debt;
    private final AuditLogger audit;

    public CustomerManageService(CustomerService service, CustomerListQuery listQuery, CustomerRepository customers,
                                 CustomerDebtRepository debts, DebtService debt, AuditLogger audit) {
        this.service = service;
        this.listQuery = listQuery;
        this.customers = customers;
        this.debts = debts;
        this.debt = debt;
        this.audit = audit;
    }

    public CustomerListResponse list(CustomerListQuery.Filter filter) {
        return listQuery.search(filter);
    }

    public List<String> groupNames() {
        return customers.findGroupNames();
    }

    public CustomerResponse get(UUID id) {
        return CustomerResponse.of(service.find(id));
    }

    public CustomerResponse create(CustomerRequest req, Actor actor) {
        Customer c = service.create(req, actor);
        actor.audit(audit, c.getBranchId(), "Khách hàng", "Tạo", c.getCode(),
                "Tạo khách hàng " + c.getCode() + ", tên " + c.getName() + (c.getPhone() == null ? "" : ", SĐT " + c.getPhone()));
        return CustomerResponse.of(c);
    }

    public CustomerResponse update(UUID id, CustomerRequest req, Actor actor) {
        Customer c = service.update(id, req);
        actor.audit(audit, c.getBranchId(), "Khách hàng", "Sửa", c.getCode(),
                "Cập nhật thông tin khách hàng " + c.getCode() + ", tên " + c.getName());
        return CustomerResponse.of(c);
    }

    public List<DebtLine> debts(UUID id) {
        return debts.latest(id);
    }

    public Map<String, String> pay(UUID id, DebtService.PaymentRequest req, Actor actor) {
        String code = debt.pay(id, req, actor);
        actor.audit(audit, req.branchId(), "Phiếu thu", "Thu nợ", code,
                "Thu nợ khách " + service.find(id).getName() + ": " + Actor.money(req.amount()) + ", phiếu " + code);
        return Map.of("code", code);
    }

    public Map<String, String> discount(UUID id, DebtService.PaymentRequest req, Actor actor) {
        String code = debt.discount(id, req, actor);
        actor.audit(audit, req.branchId(), "Khách hàng", "Chiết khấu", code,
                "Chiết khấu thanh toán cho khách " + service.find(id).getName() + ": " + Actor.money(req.amount()));
        return Map.of("code", code);
    }

    public Map<String, String> adjust(UUID id, DebtService.AdjustRequest req, Actor actor) {
        String code = debt.adjust(id, req);
        actor.audit(audit, null, "Khách hàng", "Điều chỉnh nợ", code,
                "Điều chỉnh công nợ khách " + service.find(id).getName() + " thành " + Actor.money(req.newDebt()));
        return Map.of("code", code);
    }
}
