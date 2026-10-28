package com.vaxclinic.product.product;

import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.product.product.ProductDtos.LedgerLine;
import com.vaxclinic.product.product.ProductDtos.LotResponse;
import com.vaxclinic.product.product.ProductDtos.ProductDetail;
import com.vaxclinic.product.product.ProductDtos.ProductListResponse;
import com.vaxclinic.product.product.ProductDtos.ProductRequest;
import com.vaxclinic.product.product.ProductListQuery.StockFilter;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/products")
@PreAuthorize("hasAuthority('catalog.view')")
public class ProductController {

    private final ProductCommandService commands;
    private final ProductListQuery listQuery;
    private final ProductDetailQuery detailQuery;

    public ProductController(ProductCommandService commands, ProductListQuery listQuery,
                             ProductDetailQuery detailQuery) {
        this.commands = commands;
        this.listQuery = listQuery;
        this.detailQuery = detailQuery;
    }

    @GetMapping
    public ProductListResponse list(@RequestParam(required = false) String q,
                                    @RequestParam(required = false) List<UUID> categoryIds,
                                    @RequestParam(required = false) List<UUID> taxRateIds,
                                    @RequestParam(required = false) Boolean taxReduction,
                                    @RequestParam(defaultValue = "ALL") StockFilter stock,
                                    @RequestParam(required = false) UUID branchId,
                                    @RequestParam(required = false) Instant createdFrom,
                                    @RequestParam(required = false) Instant createdTo,
                                    @RequestParam(required = false) Boolean active,
                                    @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "15") int size) {
        return listQuery.search(new ProductListQuery.Filter(q, categoryIds, taxRateIds, taxReduction, stock, branchId,
                createdFrom, createdTo, active, Math.max(page, 0), Math.min(Math.max(size, 1), 100)));
    }

    @GetMapping("/{id}")
    public ProductDetail get(@PathVariable UUID id) {
        return detailQuery.get(id);
    }

    @GetMapping("/{id}/ledger")
    public PageResponse<LedgerLine> ledger(@PathVariable UUID id, @RequestParam(required = false) UUID branchId,
                                           @RequestParam(defaultValue = "0") int page,
                                           @RequestParam(defaultValue = "20") int size) {
        return detailQuery.ledger(id, branchId, page, size);
    }

    @GetMapping("/{id}/lots")
    public List<LotResponse> lots(@PathVariable UUID id) {
        return detailQuery.lots(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('catalog.manage')")
    public ProductDetail create(@Valid @RequestBody ProductRequest req, @AuthenticationPrincipal Jwt jwt) {
        List<String> branches = jwt.getClaimAsStringList("branches");
        UUID id = commands.create(req, UUID.fromString(jwt.getSubject()), branches == null ? List.of() : branches);
        return detailQuery.get(id);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public ProductDetail update(@PathVariable UUID id, @Valid @RequestBody ProductRequest req) {
        commands.update(id, req);
        return detailQuery.get(id);
    }

    /** Ngừng kinh doanh / cho phép kinh doanh. Body: {"active": false} */
    @PatchMapping("/{id}/active")
    @PreAuthorize("hasAuthority('catalog.manage')")
    public ProductDetail setActive(@PathVariable UUID id, @RequestBody Map<String, Boolean> body) {
        commands.setActive(id, Boolean.TRUE.equals(body.get("active")));
        return detailQuery.get(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAuthority('catalog.manage')")
    public void delete(@PathVariable UUID id) {
        commands.delete(id);
    }
}
