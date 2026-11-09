package com.vaxclinic.product.pricebook.controller;

import com.vaxclinic.product.pricebook.dto.PriceBookDtos;
import com.vaxclinic.product.pricebook.service.PriceBookItemService;
import com.vaxclinic.product.pricebook.service.PriceBookRowQuery;
import com.vaxclinic.product.pricebook.service.PriceBookService;
import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.CountResponse;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.FormulaRequest;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.ImportRequest;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.ImportResult;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.ItemsRequest;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.PriceBookRequest;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.PriceBookResponse;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.PriceRow;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.RowFilter;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Hàng hóa → Thiết lập giá. Xem: catalog.view; sửa bảng giá / giá: catalog.manage (như sửa hàng hóa). */
@RestController
@RequestMapping("/api/price-books")
@PreAuthorize("hasAuthority('catalog.view')")
public class PriceBookController {

    private static final String FEATURE = "Thiết lập giá";

    private final PriceBookService books;
    private final PriceBookItemService items;
    private final PriceBookRowQuery rows;
    private final AuditLogger audit;

    public PriceBookController(PriceBookService books, PriceBookItemService items, PriceBookRowQuery rows,
                               AuditLogger audit) {
        this.books = books;
        this.items = items;
        this.rows = rows;
        this.audit = audit;
    }

    private void log(Jwt jwt, String action, String bookName, String detail) {
        audit.record(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"), null, FEATURE, action, bookName, detail);
    }

    @GetMapping
    public List<PriceBookResponse> list() {
        return books.list();
    }

    /** Ma trận giá: dòng = đơn vị tính theo bộ lọc, cột = các bảng giá bookIds. */
    @GetMapping("/items")
    public PageResponse<PriceRow> matrix(@RequestParam(required = false) List<UUID> bookIds,
                                         @RequestParam(required = false) String q,
                                         @RequestParam(required = false) List<UUID> categoryIds,
                                         @RequestParam(required = false) String stock,
                                         @RequestParam(required = false) UUID branchId,
                                         @RequestParam(defaultValue = "false") boolean inBookOnly,
                                         @RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "15") int size) {
        return rows.rows(bookIds, new RowFilter(q, categoryIds, stock, branchId, inBookOnly),
                Math.max(page, 0), Math.min(Math.max(size, 1), 100));
    }

    @GetMapping("/{id}")
    public PriceBookResponse get(@PathVariable UUID id) {
        return books.get(id);
    }

    /** Giá của 1 bảng giá; mặc định chỉ hàng đã có trong bảng. */
    @GetMapping("/{id}/items")
    public PageResponse<PriceRow> items(@PathVariable UUID id, @RequestParam(required = false) String q,
                                        @RequestParam(required = false) List<UUID> categoryIds,
                                        @RequestParam(required = false) String stock,
                                        @RequestParam(required = false) UUID branchId,
                                        @RequestParam(defaultValue = "true") boolean inBookOnly,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "15") int size) {
        books.get(id);
        return matrix(List.of(id), q, categoryIds, stock, branchId, inBookOnly, page, size);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('catalog.manage')")
    public PriceBookResponse create(@Valid @RequestBody PriceBookRequest req, @AuthenticationPrincipal Jwt jwt) {
        PriceBookResponse b = books.get(books.create(req, UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name")));
        log(jwt, "Tạo", b.name(), "Tạo bảng giá " + b.name());
        return b;
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public PriceBookResponse update(@PathVariable UUID id, @Valid @RequestBody PriceBookRequest req,
                                    @AuthenticationPrincipal Jwt jwt) {
        books.update(id, req);
        PriceBookResponse b = books.get(id);
        log(jwt, "Sửa", b.name(), "Cập nhật bảng giá " + b.name());
        return b;
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('catalog.manage')")
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        PriceBookResponse b = books.get(id);
        books.delete(id);
        log(jwt, "Xóa", b.name(), "Xóa bảng giá " + b.name());
    }

    @PutMapping("/{id}/items")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public CountResponse upsert(@PathVariable UUID id, @Valid @RequestBody ItemsRequest req, @AuthenticationPrincipal Jwt jwt) {
        int n = items.upsert(id, req.items());
        String name = books.get(id).name();
        log(jwt, "Sửa giá", name, "Cập nhật " + n + " giá trong bảng giá " + name);
        return new CountResponse(n);
    }

    @PostMapping("/{id}/items/apply-formula")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public CountResponse applyFormula(@PathVariable UUID id, @Valid @RequestBody FormulaRequest req,
                                      @AuthenticationPrincipal Jwt jwt) {
        int n = items.applyFormula(id, req);
        String name = books.get(id).name();
        log(jwt, "Áp dụng công thức", name, "Áp dụng công thức " + req.base() + (req.op() == PriceBookDtos.Op.PLUS ? " + " : " - ")
                + req.value().stripTrailingZeros().toPlainString() + (req.percent() ? "%" : "") + " cho " + n
                + " hàng trong bảng giá " + name);
        return new CountResponse(n);
    }

    @PostMapping("/{id}/items/import")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public ImportResult importItems(@PathVariable UUID id, @Valid @RequestBody ImportRequest req,
                                    @AuthenticationPrincipal Jwt jwt) {
        ImportResult r = items.importRows(id, req.rows());
        String name = books.get(id).name();
        log(jwt, "Nhập file", name, "Nhập file giá: " + r.updated() + " dòng thành công, " + r.errors().size()
                + " dòng lỗi, bảng giá " + name);
        return r;
    }
}
