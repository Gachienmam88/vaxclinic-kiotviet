package com.vaxclinic.sales.salesreturn.service;

import com.vaxclinic.sales.salesreturn.client.ProductCatalogClient;
import com.vaxclinic.sales.salesreturn.dto.SalesReturnDtos;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.common.SalesRules;
import com.vaxclinic.sales.customer.entity.Customer;
import com.vaxclinic.sales.customer.repository.CustomerRepository;
import com.vaxclinic.sales.invoice.client.ProductStockClient;
import com.vaxclinic.sales.salesreturn.dto.SalesReturnDtos.ReturnRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * "Trả nhanh" — khách trả hàng KHÔNG theo hóa đơn (không mở transaction — gọi HTTP sang product-service):
 * tra hàng + đơn vị (tỷ lệ quy đổi từ product-service) → kho nhập lại SALE_RETURN theo lô chỉ định (idempotent theo id phiếu)
 * → SalesReturnWriter ghi phiếu TH, phiếu chi PC, công nợ như trả theo hóa đơn. Khách lẻ: phải hoàn đủ tiền.
 * Hàng theo lô: chọn lô ĐÃ CÓ tại chi nhánh (hạn bỏ trống / trùng hạn lô) hoặc nhập lô MỚI + hạn sử dụng → kho tạo lô.
 * Giá vốn dòng = giá vốn hiện tại của hàng (kho không đổi giá vốn khi khách trả).
 */
@Service
public class QuickReturnService {

    private final JdbcTemplate jdbc;
    private final ProductStockClient stock;
    private final ProductCatalogClient catalog;
    private final SalesReturnWriter writer;
    private final SalesRules rules;
    private final CustomerRepository customers;

    public QuickReturnService(JdbcTemplate jdbc, ProductStockClient stock, ProductCatalogClient catalog,
                              SalesReturnWriter writer, SalesRules rules, CustomerRepository customers) {
        this.jdbc = jdbc;
        this.stock = stock;
        this.catalog = catalog;
        this.writer = writer;
        this.rules = rules;
        this.customers = customers;
    }

    public UUID create(ReturnRequest req, Actor actor, String bearerToken) {
        if (writer.exists(req.id())) {
            return req.id();
        }
        if (req.branchId() == null) {
            throw BusinessException.badRequest("BRANCH_REQUIRED", "Trả nhanh: chưa chọn chi nhánh");
        }
        actor.checkBranch(req.branchId());
        Instant returnedAt = req.returnedAt() == null ? Instant.now() : req.returnedAt();
        rules.checkNotLocked(req.branchId(), returnedAt);
        Customer customer = req.customerId() == null ? null : customers.findById(req.customerId())
                .orElseThrow(() -> BusinessException.badRequest("CUSTOMER_NOT_FOUND", "Khách hàng không tồn tại"));
        String customerName = customer == null ? "Khách lẻ" : customer.getName();

        var rows = new ArrayList<SalesReturnWriter.Row>();
        var stockLines = new ArrayList<ProductStockClient.Line>();
        var rates = new ArrayList<BigDecimal>();
        for (int i = 0; i < req.lines().size(); i++) {
            var in = req.lines().get(i);
            if (in.productId() == null || in.unitId() == null || in.unitPrice() == null) {
                throw BusinessException.badRequest("QUICK_RETURN_LINE_INVALID",
                        "Trả nhanh: dòng " + (i + 1) + " thiếu hàng hóa / đơn vị tính / giá trả");
            }
            var p = catalog.get(in.productId(), bearerToken);
            var unit = p.units() == null ? null : p.units().stream().filter(u -> u.id().equals(in.unitId())).findFirst().orElse(null);
            if (unit == null || unit.conversionRate() == null || unit.conversionRate().signum() <= 0) {
                throw BusinessException.badRequest("UNIT_NOT_FOUND", p.name() + ": đơn vị tính không hợp lệ");
            }
            String lot = in.lotNumber() == null || in.lotNumber().isBlank() ? null : in.lotNumber().trim();
            if (p.lotManaged() && lot == null) {
                throw BusinessException.badRequest("LOT_REQUIRED", p.name() + ": chọn lô hàng trả");
            }
            if (!p.lotManaged()) {
                lot = null;
            }
            BigDecimal baseQty = in.quantity().multiply(unit.conversionRate()).setScale(3, RoundingMode.HALF_UP);
            UUID lineId = UUID.nameUUIDFromBytes((req.id() + ":" + i).getBytes(StandardCharsets.UTF_8));
            stockLines.add(new ProductStockClient.Line(lineId, p.id(), null, null, lot, baseQty,
                    lot == null ? null : in.expiryDate()));
            rates.add(unit.conversionRate());
            rows.add(new SalesReturnWriter.Row(lineId, null, p.id(), unit.code(), p.name(), unit.unitName(), in.quantity(),
                    in.unitPrice(), Map.of(lot == null ? "" : lot, baseQty), null));
        }
        BigDecimal subtotal = rows.stream().map(r -> r.quantity().multiply(r.unitPrice()).setScale(0, RoundingMode.HALF_UP))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discount = money(req.discount()).min(subtotal);
        BigDecimal fee = money(req.fee()).min(subtotal.subtract(discount));
        BigDecimal total = subtotal.subtract(discount).subtract(fee);
        BigDecimal refund = req.refundAmount() == null ? total : money(req.refundAmount()).min(total);
        if (customer == null && refund.compareTo(total) < 0) {
            throw BusinessException.badRequest("WALK_IN_REFUND", "Khách lẻ: phải trả đủ tiền cho khách");
        }
        String code = "TH%06d".formatted(jdbc.queryForObject("select nextval('sales_return_code_seq')", Long.class));
        ProductStockClient.Result result;
        try {
            result = stock.apply(new ProductStockClient.Request(req.id(), "SALE_RETURN", code, req.branchId(), customerName,
                    actor.id(), null, stockLines));
        } catch (BusinessException e) {
            if ("EXPIRY_REQUIRED".equals(e.getCode())) { // lô chưa từng có tại chi nhánh, không gửi hạn sử dụng
                throw BusinessException.badRequest("EXPIRY_REQUIRED",
                        e.getMessage().replace(": cần nhập hạn sử dụng", "") + " chưa có tại chi nhánh — nhập hạn sử dụng để tạo lô mới");
            }
            throw e;
        }
        // Giá vốn / 1 đơn vị trả = giá vốn đơn vị cơ bản lúc nhập lại × tỷ lệ quy đổi
        Map<UUID, ProductStockClient.LineResult> byLine = result.lines().stream()
                .collect(Collectors.toMap(ProductStockClient.LineResult::lineId, Function.identity(), (a, b) -> a));
        List<SalesReturnWriter.Row> costed = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            var r = rows.get(i);
            var sr = byLine.get(r.lineId());
            BigDecimal cost = sr == null || sr.unitCost() == null ? null
                    : sr.unitCost().multiply(rates.get(i)).setScale(4, RoundingMode.HALF_UP);
            costed.add(new SalesReturnWriter.Row(r.lineId(), null, r.productId(), r.productCode(), r.productName(),
                    r.unitName(), r.quantity(), r.unitPrice(), r.lots(), cost));
        }
        writer.persist(req, new SalesReturnWriter.Header(null, null, req.branchId(), customer == null ? null : customer.getId(),
                customerName), code, costed, subtotal, discount, fee, total, refund, actor);
        return req.id();
    }

    private static BigDecimal money(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v.setScale(0, RoundingMode.HALF_UP);
    }
}
