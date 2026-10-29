package com.vaxclinic.product.product;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.product.pricebook.SalePriceBookQuery;
import com.vaxclinic.product.product.ProductDtos.LedgerLine;
import com.vaxclinic.product.product.ProductDtos.LotResponse;
import com.vaxclinic.product.product.ProductDtos.ProductDetail;
import com.vaxclinic.product.product.ProductDtos.ProductListResponse;
import com.vaxclinic.product.product.ProductDtos.ProductRequest;
import com.vaxclinic.product.purchase.PurchaseDtos.Actor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Hàng hóa cho màn hình: danh sách / chi tiết / thẻ kho / lô, danh mục bán hàng; ghi hàng hóa qua
 * {@link ProductCommandService} (transaction riêng) rồi đọc lại và ghi lịch sử thao tác sau khi đã commit.
 */
@Service
public class ProductManageService {

    /** Danh mục + bảng giá đang áp dụng tại điểm tiêm (withPriceBooks=true). */
    public record SaleCatalogResponse(List<SaleCatalogQuery.SaleProduct> products, List<SalePriceBookQuery.SalePriceBook> priceBooks) {
    }

    private final ProductCommandService commands;
    private final ProductListQuery listQuery;
    private final ProductDetailQuery detailQuery;
    private final SaleCatalogQuery saleCatalog;
    private final SalePriceBookQuery salePriceBooks;
    private final AuditLogger audit;

    public ProductManageService(ProductCommandService commands, ProductListQuery listQuery, ProductDetailQuery detailQuery,
                                SaleCatalogQuery saleCatalog, SalePriceBookQuery salePriceBooks, AuditLogger audit) {
        this.commands = commands;
        this.listQuery = listQuery;
        this.detailQuery = detailQuery;
        this.saleCatalog = saleCatalog;
        this.salePriceBooks = salePriceBooks;
        this.audit = audit;
    }

    public ProductListResponse list(ProductListQuery.Filter filter) {
        return listQuery.search(filter);
    }

    /** Mặc định trả mảng hàng hóa; withPriceBooks=true trả {products, priceBooks}. */
    public Object saleCatalog(UUID branchId, boolean withPriceBooks) {
        List<SaleCatalogQuery.SaleProduct> products = saleCatalog.load(branchId);
        return withPriceBooks ? new SaleCatalogResponse(products, salePriceBooks.load(branchId)) : products;
    }

    public ProductDetail get(UUID id) {
        return detailQuery.get(id);
    }

    public PageResponse<LedgerLine> ledger(UUID id, UUID branchId, int page, int size) {
        return detailQuery.ledger(id, branchId, page, size);
    }

    public List<LotResponse> lots(UUID id) {
        return detailQuery.lots(id);
    }

    public ProductDetail create(ProductRequest req, Actor actor) {
        UUID id = commands.create(req, actor.id(), actor.branchIds());
        ProductDetail p = detailQuery.get(id);
        log(actor, "Tạo", p, "Tạo hàng hóa " + p.name());
        return p;
    }

    public ProductDetail update(UUID id, ProductRequest req, Actor actor) {
        commands.update(id, req);
        ProductDetail p = detailQuery.get(id);
        log(actor, "Sửa", p, "Cập nhật hàng hóa " + p.name());
        return p;
    }

    /** Ngừng kinh doanh / cho phép kinh doanh. */
    public ProductDetail setActive(UUID id, boolean active, Actor actor) {
        commands.setActive(id, active);
        ProductDetail p = detailQuery.get(id);
        log(actor, active ? "Kinh doanh" : "Ngừng kinh doanh", p, (active ? "Cho phép kinh doanh " : "Ngừng kinh doanh ") + p.name());
        return p;
    }

    public void delete(UUID id, Actor actor) {
        ProductDetail p = detailQuery.get(id);
        commands.delete(id);
        log(actor, "Xóa", p, "Xóa hàng hóa " + p.name());
    }

    /** Ghi lịch sử thao tác hàng hóa. */
    private void log(Actor actor, String action, ProductDetail p, String detail) {
        audit.record(actor.id(), actor.name(), null, "Hàng hóa", action,
                p.units().isEmpty() ? null : p.units().get(0).code(), detail);
    }
}
