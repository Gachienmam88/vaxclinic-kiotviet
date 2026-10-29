package com.vaxclinic.product.internal;

import com.vaxclinic.product.internal.ProductTaxInfoRepository.ProductTaxInfo;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

/** Thông tin thuế của danh sách hàng (bỏ id trùng; hàng không tồn tại thì không có trong kết quả). */
@Service
public class InternalProductTaxService {

    private final ProductTaxInfoRepository repo;

    public InternalProductTaxService(ProductTaxInfoRepository repo) {
        this.repo = repo;
    }

    public List<ProductTaxInfo> taxInfo(List<UUID> ids) {
        return repo.find(new LinkedHashSet<>(ids));
    }
}
