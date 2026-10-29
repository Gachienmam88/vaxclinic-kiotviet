package com.vaxclinic.product.pricebook;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.pricebook.PriceBookDtos.BasePriceInput;
import com.vaxclinic.product.pricebook.PriceBookDtos.FormulaBase;
import com.vaxclinic.product.pricebook.PriceBookDtos.FormulaRequest;
import com.vaxclinic.product.pricebook.PriceBookDtos.ImportError;
import com.vaxclinic.product.pricebook.PriceBookDtos.ImportResult;
import com.vaxclinic.product.pricebook.PriceBookDtos.ImportRow;
import com.vaxclinic.product.pricebook.PriceBookDtos.ItemInput;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Ghi giá trong bảng giá / giá chung: sửa từng ô / hàng loạt, áp dụng công thức, nhập file (Mã hàng, Giá). */
@Service
public class PriceBookItemService {

    private final PriceBookItemRepository repo;
    private final PriceBookService books;

    public PriceBookItemService(PriceBookItemRepository repo, PriceBookService books) {
        this.repo = repo;
        this.books = books;
    }

    /** price = null → xóa khỏi bảng giá. Trả về số dòng đã ghi. */
    @Transactional
    public int upsert(UUID bookId, List<ItemInput> items) {
        books.get(bookId);
        var unitIds = items.stream().map(ItemInput::unitId).distinct().toList();
        Integer found = repo.countUnits(unitIds);
        if (found == null || found != unitIds.size()) {
            throw BusinessException.badRequest("UNIT_NOT_FOUND", "Có hàng hóa không tồn tại");
        }
        int n = 0;
        for (ItemInput it : items) {
            n += it.price() == null
                    ? repo.delete(bookId, it.unitId())
                    : repo.upsert(bookId, it.unitId(), it.price());
        }
        return n;
    }

    /** Giá mới = gốc ± value (VNĐ hoặc %), làm tròn VNĐ, tối thiểu 0. Dòng không có giá gốc (VD chưa nhập hàng) bỏ qua. */
    @Transactional
    public int applyFormula(UUID bookId, FormulaRequest req) {
        books.get(bookId);
        checkFormula(req);
        return repo.applyFormula(bookId, req);
    }

    /** Sửa giá chung từng đơn vị (cột "Bảng giá chung"); bảng giá theo giá chung tự cập nhật qua trigger. */
    @Transactional
    public int upsertBase(List<BasePriceInput> items) {
        var unitIds = items.stream().map(BasePriceInput::unitId).distinct().toList();
        Integer found = repo.countUnits(unitIds);
        if (found == null || found != unitIds.size()) {
            throw BusinessException.badRequest("UNIT_NOT_FOUND", "Có hàng hóa không tồn tại");
        }
        int n = 0;
        for (BasePriceInput it : items) {
            n += repo.updateBasePrice(it.unitId(), it.price());
        }
        return n;
    }

    /** Công thức trên cột "Bảng giá chung": ghi vào giá chung của các dòng thuộc bộ lọc / unitIds. */
    @Transactional
    public int applyFormulaToBase(FormulaRequest req) {
        checkFormula(req);
        return repo.applyFormulaToBase(req);
    }

    private void checkFormula(FormulaRequest req) {
        if (req.base() == FormulaBase.BOOK) {
            if (req.baseBookId() == null) {
                throw BusinessException.badRequest("FORMULA_BOOK_REQUIRED", "Chọn bảng giá làm gốc công thức");
            }
            books.get(req.baseBookId());
        }
    }

    /** Dòng hợp lệ được ghi, dòng lỗi trả về kèm số dòng; mã hàng trùng trong file → lấy dòng sau cùng. */
    @Transactional
    public ImportResult importRows(UUID bookId, List<ImportRow> rows) {
        books.get(bookId);
        var codes = rows.stream().map(r -> r.code() == null ? "" : r.code().trim().toLowerCase()).distinct().toList();
        Map<String, UUID> units = repo.unitIdsByCode(codes);
        var errors = new ArrayList<ImportError>();
        int n = 0;
        for (ImportRow r : rows) {
            String code = r.code() == null ? "" : r.code().trim();
            UUID unit = units.get(code.toLowerCase());
            BigDecimal price = parsePrice(r.price());
            if (code.isEmpty()) {
                errors.add(new ImportError(r.line(), code, "Thiếu mã hàng"));
            } else if (unit == null) {
                errors.add(new ImportError(r.line(), code, "Không tìm thấy mã hàng"));
            } else if (price == null) {
                errors.add(new ImportError(r.line(), code, "Giá không hợp lệ: " + (r.price() == null ? "" : r.price())));
            } else if (price.signum() < 0) {
                errors.add(new ImportError(r.line(), code, "Giá không được âm"));
            } else {
                n += repo.upsert(bookId, unit, price);
            }
        }
        return new ImportResult(n, errors);
    }

    /** "1,250,000" / "1250000" / "1250000.5" → số; trống hoặc sai định dạng → null. */
    static BigDecimal parsePrice(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(s.trim().replace(",", "").replace(" ", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
