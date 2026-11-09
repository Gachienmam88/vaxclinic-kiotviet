package com.vaxclinic.product.product.service;

import com.vaxclinic.product.product.dto.ProductDtos;
import com.vaxclinic.product.product.entity.Product;
import com.vaxclinic.product.product.entity.ProductUnit;
import com.vaxclinic.product.product.repository.ProductRepository;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.product.dto.ProductDtos.UnitInput;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Đồng bộ danh sách đơn vị tính từ form vào entity.
 * Quy tắc: phần tử đầu là đơn vị cơ bản (quy đổi = 1); tên đơn vị không trùng; mã hàng trống thì tự sinh SPxxxxxx.
 * Đơn vị cơ bản không được xóa (tồn kho tính theo nó).
 */
@Component
public class ProductUnitSync {

    private final ProductRepository products;

    public ProductUnitSync(ProductRepository products) {
        this.products = products;
    }

    public void sync(Product p, List<UnitInput> inputs) {
        if (inputs.get(0).conversionRate().compareTo(BigDecimal.ONE) != 0) {
            throw BusinessException.badRequest("BASE_UNIT_RATE", "Đơn vị cơ bản phải có giá trị quy đổi = 1");
        }
        var names = new HashSet<String>();
        var codes = new HashSet<String>();
        for (var in : inputs) {
            if (!names.add(in.unitName().trim().toLowerCase())) {
                throw BusinessException.badRequest("UNIT_DUPLICATE", "Trùng tên đơn vị: " + in.unitName());
            }
            if (in.code() != null && !in.code().isBlank() && !codes.add(in.code().trim().toLowerCase())) {
                throw BusinessException.badRequest("CODE_DUPLICATE", "Trùng mã hàng: " + in.code());
            }
        }

        Map<UUID, ProductUnit> existing = p.getUnits().stream()
                .collect(Collectors.toMap(ProductUnit::getId, Function.identity()));
        UUID baseId = existing.values().stream().filter(ProductUnit::isBase).map(ProductUnit::getId).findFirst().orElse(null);
        if (baseId != null && !baseId.equals(inputs.get(0).id())) {
            throw BusinessException.badRequest("BASE_UNIT_LOCKED", "Không được đổi hoặc xóa đơn vị cơ bản");
        }

        var keep = new HashSet<UUID>();
        for (int i = 0; i < inputs.size(); i++) {
            var in = inputs.get(i);
            ProductUnit unit;
            if (in.id() != null) {
                unit = existing.get(in.id());
                if (unit == null) {
                    throw BusinessException.badRequest("UNIT_NOT_FOUND", "Đơn vị không thuộc hàng hóa này");
                }
            } else {
                unit = new ProductUnit();
                unit.setId(UUID.randomUUID());
                unit.setProduct(p);
                p.getUnits().add(unit);
            }
            keep.add(unit.getId());
            unit.setCode(resolveCode(in.code(), unit));
            unit.setBarcode(in.barcode() == null || in.barcode().isBlank() ? null : in.barcode().trim());
            unit.setUnitName(in.unitName().trim());
            unit.setConversionRate(i == 0 ? BigDecimal.ONE : in.conversionRate());
            unit.setPrice(in.price());
            unit.setBase(i == 0);
            unit.setDirectSale(in.directSale());
            unit.setSortOrder(i);
        }
        p.getUnits().removeIf(u -> !keep.contains(u.getId()));
    }

    private String resolveCode(String requested, ProductUnit unit) {
        if (requested == null || requested.isBlank()) {
            return unit.getCode() != null ? unit.getCode() : "SP%06d".formatted(products.nextCodeNumber());
        }
        String code = requested.trim().toUpperCase();
        boolean taken = unit.getCode() == null ? products.existsUnitCode(code) : products.existsUnitCodeExcept(code, unit.getId());
        if (taken) {
            throw BusinessException.conflict("PRODUCT_CODE_EXISTS", "Mã hàng " + code + " đã tồn tại");
        }
        return code;
    }
}
