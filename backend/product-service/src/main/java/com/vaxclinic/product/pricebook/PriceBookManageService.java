package com.vaxclinic.product.pricebook;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.product.pricebook.PriceBookDtos.CountResponse;
import com.vaxclinic.product.pricebook.PriceBookDtos.FormulaRequest;
import com.vaxclinic.product.pricebook.PriceBookDtos.ImportRequest;
import com.vaxclinic.product.pricebook.PriceBookDtos.ImportResult;
import com.vaxclinic.product.pricebook.PriceBookDtos.ItemsRequest;
import com.vaxclinic.product.pricebook.PriceBookDtos.PriceBookRequest;
import com.vaxclinic.product.pricebook.PriceBookDtos.PriceBookResponse;
import com.vaxclinic.product.pricebook.PriceBookDtos.PriceRow;
import com.vaxclinic.product.pricebook.PriceBookDtos.RowFilter;
import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Thiết lập giá cho màn hình: bảng giá ({@link PriceBookService}), giá trong bảng ({@link PriceBookItemService}),
 * ma trận giá; ghi lịch sử thao tác sau khi transaction của từng thao tác đã commit.
 */
@Service
public class PriceBookManageService {

    private static final String FEATURE = "Thiết lập giá";

    private final PriceBookService books;
    private final PriceBookItemService items;
    private final PriceBookRowRepository rows;
    private final AuditLogger audit;

    public PriceBookManageService(PriceBookService books, PriceBookItemService items, PriceBookRowRepository rows,
                                  AuditLogger audit) {
        this.books = books;
        this.items = items;
        this.rows = rows;
        this.audit = audit;
    }

    public List<PriceBookResponse> list() {
        return books.list();
    }

    /** Ma trận giá: dòng = đơn vị tính theo bộ lọc, cột = các bảng giá bookIds. */
    public PageResponse<PriceRow> matrix(List<UUID> bookIds, RowFilter filter, int page, int size) {
        return rows.rows(bookIds, filter, page, size);
    }

    public PriceBookResponse get(UUID id) {
        return books.get(id);
    }

    /** Giá của 1 bảng giá (bảng giá phải tồn tại). */
    public PageResponse<PriceRow> items(UUID id, RowFilter filter, int page, int size) {
        books.get(id);
        return matrix(List.of(id), filter, page, size);
    }

    public PriceBookResponse create(PriceBookRequest req, Actor actor) {
        PriceBookResponse b = books.get(books.create(req, actor.id(), actor.name()));
        log(actor, "Tạo", b.name(), "Tạo bảng giá " + b.name());
        return b;
    }

    public PriceBookResponse update(UUID id, PriceBookRequest req, Actor actor) {
        books.update(id, req);
        PriceBookResponse b = books.get(id);
        log(actor, "Sửa", b.name(), "Cập nhật bảng giá " + b.name());
        return b;
    }

    public void delete(UUID id, Actor actor) {
        PriceBookResponse b = books.get(id);
        books.delete(id);
        log(actor, "Xóa", b.name(), "Xóa bảng giá " + b.name());
    }

    public CountResponse upsert(UUID id, ItemsRequest req, Actor actor) {
        int n = items.upsert(id, req.items());
        String name = books.get(id).name();
        log(actor, "Sửa giá", name, "Cập nhật " + n + " giá trong bảng giá " + name);
        return new CountResponse(n);
    }

    public CountResponse applyFormula(UUID id, FormulaRequest req, Actor actor) {
        int n = items.applyFormula(id, req);
        String name = books.get(id).name();
        log(actor, "Áp dụng công thức", name, "Áp dụng công thức " + req.base() + (req.op() == PriceBookDtos.Op.PLUS ? " + " : " - ")
                + req.value().stripTrailingZeros().toPlainString() + (req.percent() ? "%" : "") + " cho " + n
                + " hàng trong bảng giá " + name);
        return new CountResponse(n);
    }

    public ImportResult importItems(UUID id, ImportRequest req, Actor actor) {
        ImportResult r = items.importRows(id, req.rows());
        String name = books.get(id).name();
        log(actor, "Nhập file", name, "Nhập file giá: " + r.updated() + " dòng thành công, " + r.errors().size()
                + " dòng lỗi, bảng giá " + name);
        return r;
    }

    private void log(Actor actor, String action, String bookName, String detail) {
        audit.record(actor.id(), actor.name(), null, FEATURE, action, bookName, detail);
    }
}
