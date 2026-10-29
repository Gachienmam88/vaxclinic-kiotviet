package com.vaxclinic.product.pricebook;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.pricebook.PriceBookDtos.FormulaBase;
import com.vaxclinic.product.pricebook.PriceBookDtos.FormulaRequest;
import com.vaxclinic.product.pricebook.PriceBookDtos.PriceBookRequest;
import com.vaxclinic.product.pricebook.PriceBookDtos.PriceBookResponse;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/** Bảng giá: thêm / sửa / xóa + kiểm tra hợp lệ (tên không trùng, hiệu lực từ < đến, phạm vi không rỗng) + công thức giá. */
@Service
public class PriceBookService {

    private final PriceBookRepository repo;
    private final PriceBookItemRepository items;

    public PriceBookService(PriceBookRepository repo, PriceBookItemRepository items) {
        this.repo = repo;
        this.items = items;
    }

    public List<PriceBookResponse> list() {
        return repo.list();
    }

    public PriceBookResponse get(UUID id) {
        return repo.find(id)
                .orElseThrow(() -> BusinessException.notFound("PRICE_BOOK_NOT_FOUND", "Không tìm thấy bảng giá"));
    }

    @Transactional
    public UUID create(PriceBookRequest req, UUID userId, String userName) {
        validate(null, req);
        UUID id = UUID.randomUUID();
        save(() -> repo.insert(id, req, userId, userName));
        applyStoredFormula(id, req, false);
        return id;
    }

    @Transactional
    public void update(UUID id, PriceBookRequest req) {
        get(id);
        validate(id, req);
        save(() -> repo.update(id, req));
        applyStoredFormula(id, req, true);
    }

    @Transactional
    public void delete(UUID id) {
        get(id);
        repo.delete(id);
    }

    /**
     * Công thức giá của bảng giá: tạo mới → điền giá cho mọi hàng đang kinh doanh có giá gốc; sửa → tính lại các hàng
     * đang có trong bảng (onlyExisting).
     */
    private void applyStoredFormula(UUID id, PriceBookRequest req, boolean onlyExisting) {
        FormulaBase base = req.effectiveBase();
        if (base != null) {
            items.applyFormula(id, FormulaRequest.of(base, req.autoBaseBookId(), req.autoOp(), req.autoValue(),
                    req.autoPercent(), onlyExisting));
        }
    }

    private void validate(UUID id, PriceBookRequest req) {
        if (req.autoBase() == FormulaBase.CURRENT) {
            throw BusinessException.badRequest("FORMULA_BASE_INVALID", "Gốc công thức không hợp lệ");
        }
        if (req.autoBase() == FormulaBase.BOOK) {
            if (req.autoBaseBookId() == null || req.autoBaseBookId().equals(id)) {
                throw BusinessException.badRequest("FORMULA_BOOK_REQUIRED", "Chọn bảng giá khác làm gốc công thức");
            }
            get(req.autoBaseBookId());
        }
        if (!req.validFrom().isBefore(req.validTo())) {
            throw BusinessException.badRequest("PRICE_BOOK_VALIDITY", "Ngày hiệu lực đến phải sau ngày hiệu lực từ");
        }
        checkScope(req.branchIds(), "chi nhánh");
        checkScope(req.customerGroupIds(), "nhóm khách hàng");
        checkScope(req.sellerIds(), "người tạo giao dịch");
    }

    private static void checkScope(List<UUID> ids, String label) {
        if (ids != null && ids.isEmpty()) {
            throw BusinessException.badRequest("PRICE_BOOK_SCOPE", "Chọn ít nhất 1 " + label + " hoặc chọn Tất cả");
        }
    }

    private static void save(Runnable write) {
        try {
            write.run();
        } catch (DuplicateKeyException e) {
            throw BusinessException.conflict("PRICE_BOOK_NAME_DUPLICATE", "Tên bảng giá đã tồn tại");
        }
    }
}
