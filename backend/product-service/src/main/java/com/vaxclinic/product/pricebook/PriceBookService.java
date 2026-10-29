package com.vaxclinic.product.pricebook;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.pricebook.PriceBookDtos.PriceBookRequest;
import com.vaxclinic.product.pricebook.PriceBookDtos.PriceBookResponse;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/** Bảng giá: thêm / sửa / xóa + kiểm tra hợp lệ (tên không trùng, hiệu lực từ < đến, phạm vi không rỗng). */
@Service
public class PriceBookService {

    private final PriceBookRepository repo;

    public PriceBookService(PriceBookRepository repo) {
        this.repo = repo;
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
        validate(req);
        UUID id = UUID.randomUUID();
        save(() -> repo.insert(id, req, userId, userName));
        return id;
    }

    @Transactional
    public void update(UUID id, PriceBookRequest req) {
        get(id);
        validate(req);
        save(() -> repo.update(id, req));
        if (req.autoUpdate()) {
            // Bật tự cập nhật → tính lại ngay các dòng đang có theo giá chung hiện tại.
            repo.recalculateItems(id, req);
        }
    }

    @Transactional
    public void delete(UUID id) {
        get(id);
        repo.delete(id);
    }

    private static void validate(PriceBookRequest req) {
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
