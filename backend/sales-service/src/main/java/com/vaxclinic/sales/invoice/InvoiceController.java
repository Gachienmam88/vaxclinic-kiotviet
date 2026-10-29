package com.vaxclinic.sales.invoice;

import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.invoice.InvoiceDtos.InfoRequest;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceListResponse;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceRequest;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceResponse;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Hóa đơn: danh sách / chi tiết, thanh toán, sửa, sửa thuế / thông tin, hủy. Nghiệp vụ ở {@link InvoiceManageService}. */
@RestController
@RequestMapping("/api/invoices")
@PreAuthorize("hasAuthority('sales.perform') or hasAuthority('report.view')")
public class InvoiceController {

    private final InvoiceManageService service;

    public InvoiceController(InvoiceManageService service) {
        this.service = service;
    }

    @GetMapping
    public InvoiceListResponse list(@RequestParam(required = false) String q,
                                    @RequestParam(required = false) List<String> statuses,
                                    @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
                                    @RequestParam(required = false) UUID createdBy,
                                    @RequestParam(required = false) UUID sellerId,
                                    @RequestParam(required = false) List<String> paymentMethods,
                                    @RequestParam(required = false) UUID customerId,
                                    @RequestParam(required = false) UUID branchId,
                                    @RequestParam(required = false) List<UUID> ids,
                                    @RequestParam(required = false) List<String> states,
                                    @RequestParam(required = false) List<String> deliveries,
                                    @RequestParam(required = false) List<String> returnStates,
                                    @RequestParam(required = false) List<String> einvoiceStatuses,
                                    @RequestParam(required = false) List<String> einvoiceNatures,
                                    @RequestParam(required = false) String customerQ,
                                    @RequestParam(required = false) String productQ,
                                    @RequestParam(required = false) String noteQ,
                                    @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "15") int size) {
        return service.list(new InvoiceQuery.Filter(q, statuses, from, to, createdBy, sellerId, paymentMethods, customerId,
                branchId, Math.max(page, 0), Math.min(Math.max(size, 1), 100), ids, states, deliveries, returnStates,
                einvoiceStatuses, einvoiceNatures, customerQ, productQ, noteQ));
    }

    @GetMapping("/{id}")
    public InvoiceResponse get(@PathVariable UUID id) {
        return service.get(id);
    }

    /** Thanh toán ở màn bán hàng. Gửi lại cùng id (offline / retry) trả về hóa đơn đã tạo, không tạo trùng. */
    @PostMapping
    @PreAuthorize("hasAuthority('sales.perform')")
    public InvoiceResponse create(@Valid @RequestBody InvoiceRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.create(req, Actor.of(jwt));
    }

    /** Sửa hóa đơn từ màn bán hàng. revision = số phiên bản lúc mở hóa đơn (chống sửa đè). */
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('sales.perform')")
    public InvoiceResponse update(@PathVariable UUID id, @RequestParam int revision, @Valid @RequestBody InvoiceRequest req,
                                  @AuthenticationPrincipal Jwt jwt) {
        return service.update(id, revision, req, Actor.of(jwt));
    }

    /** Sửa tỷ lệ thuế từng dòng (trước khi phát hành hóa đơn điện tử). */
    @PatchMapping("/{id}/tax-codes")
    @PreAuthorize("hasAuthority('sales.perform')")
    public InvoiceResponse updateTaxCodes(@PathVariable UUID id, @Valid @RequestBody List<InvoiceDtos.TaxCodeChange> changes,
                                          @AuthenticationPrincipal Jwt jwt) {
        return service.updateTaxCodes(id, changes, Actor.of(jwt));
    }

    /** "Xem giá bán gần nhất" của 1 hàng (ưu tiên cho đúng khách nếu có). */
    /** Xem trước "Giảm thuế" (Nghị quyết 204/2025/QH15) cho giỏ hàng đang soạn. */
    @PostMapping("/tax-reduction-preview")
    @PreAuthorize("hasAuthority('sales.perform')")
    public InvoiceDtos.TaxReductionPreview taxReductionPreview(@Valid @RequestBody InvoiceDtos.TaxReductionPreviewRequest req) {
        return service.previewTaxReduction(req);
    }

    @GetMapping("/recent-prices")
    public List<InvoiceDtos.RecentPrice> recentPrices(@RequestParam UUID productId, @RequestParam(required = false) UUID customerId) {
        return service.recentPrices(productId, customerId);
    }

    @PatchMapping("/{id}/info")
    @PreAuthorize("hasAuthority('sales.perform')")
    public InvoiceResponse updateInfo(@PathVariable UUID id, @Valid @RequestBody InfoRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.updateInfo(id, req, Actor.of(jwt));
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAuthority('sales.cancel')")
    public InvoiceResponse cancel(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        return service.cancel(id, Actor.of(jwt));
    }
}
