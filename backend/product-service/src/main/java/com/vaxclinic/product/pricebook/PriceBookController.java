package com.vaxclinic.product.pricebook;

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

/**
 * Hàng hóa → Thiết lập giá. Xem: catalog.view; sửa bảng giá / giá: catalog.manage (như sửa hàng hóa).
 * Nghiệp vụ ở {@link PriceBookManageService}.
 */
@RestController
@RequestMapping("/api/price-books")
@PreAuthorize("hasAuthority('catalog.view')")
public class PriceBookController {

    private final PriceBookManageService service;

    public PriceBookController(PriceBookManageService service) {
        this.service = service;
    }

    @GetMapping
    public List<PriceBookResponse> list() {
        return service.list();
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
        return service.matrix(bookIds, new RowFilter(q, categoryIds, stock, branchId, inBookOnly),
                Math.max(page, 0), Math.min(Math.max(size, 1), 100));
    }

    @GetMapping("/{id}")
    public PriceBookResponse get(@PathVariable UUID id) {
        return service.get(id);
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
        return service.items(id, new RowFilter(q, categoryIds, stock, branchId, inBookOnly),
                Math.max(page, 0), Math.min(Math.max(size, 1), 100));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('catalog.manage')")
    public PriceBookResponse create(@Valid @RequestBody PriceBookRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.create(req, Actor.of(jwt));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public PriceBookResponse update(@PathVariable UUID id, @Valid @RequestBody PriceBookRequest req,
                                    @AuthenticationPrincipal Jwt jwt) {
        return service.update(id, req, Actor.of(jwt));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('catalog.manage')")
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.delete(id, Actor.of(jwt));
    }

    @PutMapping("/{id}/items")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public CountResponse upsert(@PathVariable UUID id, @Valid @RequestBody ItemsRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.upsert(id, req, Actor.of(jwt));
    }

    @PostMapping("/{id}/items/apply-formula")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public CountResponse applyFormula(@PathVariable UUID id, @Valid @RequestBody FormulaRequest req,
                                      @AuthenticationPrincipal Jwt jwt) {
        return service.applyFormula(id, req, Actor.of(jwt));
    }

    @PostMapping("/{id}/items/import")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public ImportResult importItems(@PathVariable UUID id, @Valid @RequestBody ImportRequest req,
                                    @AuthenticationPrincipal Jwt jwt) {
        return service.importItems(id, req, Actor.of(jwt));
    }
}
