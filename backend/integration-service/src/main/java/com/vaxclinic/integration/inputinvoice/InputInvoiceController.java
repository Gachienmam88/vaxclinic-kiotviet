package com.vaxclinic.integration.inputinvoice;

import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Filter;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Item;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.ItemMapping;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Link;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.MappingRequest;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Page;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.ReceiptLink;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Seller;
import jakarta.validation.Valid;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Hóa đơn đầu vào → "Danh sách hóa đơn": lọc, xuất file, xem chi tiết, nhập file XML, gắn chứng từ đã lập,
 * ánh xạ hàng hóa đã nhớ. Nghiệp vụ ở {@link InputInvoiceService}.
 */
@RestController
@PreAuthorize("hasAuthority('inventory.view')")
public class InputInvoiceController {

    private final InputInvoiceService service;

    public InputInvoiceController(InputInvoiceService service) {
        this.service = service;
    }

    @GetMapping("/api/input-invoices")
    public Page list(@RequestParam(required = false) LocalDate from, @RequestParam(required = false) LocalDate to,
                     @RequestParam(required = false) String q, @RequestParam(required = false) String buyerTaxCode,
                     @RequestParam(required = false) String seller, @RequestParam(required = false) String sellerTaxCode,
                     @RequestParam(required = false) List<String> natures,
                     @RequestParam(required = false) String receiptStatus,
                     @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "15") int size) {
        return service.list(new Filter(from, to, q, buyerTaxCode, seller, sellerTaxCode, natures, receiptStatus), page, size);
    }

    /** Xuất file: mọi hóa đơn khớp bộ lọc (không phân trang, tối đa 5.000). */
    @GetMapping("/api/input-invoices/export")
    public List<Item> export(@RequestParam(required = false) LocalDate from, @RequestParam(required = false) LocalDate to,
                             @RequestParam(required = false) String q, @RequestParam(required = false) String buyerTaxCode,
                             @RequestParam(required = false) String seller, @RequestParam(required = false) String sellerTaxCode,
                             @RequestParam(required = false) List<String> natures,
                             @RequestParam(required = false) String receiptStatus) {
        return service.export(new Filter(from, to, q, buyerTaxCode, seller, sellerTaxCode, natures, receiptStatus));
    }

    @GetMapping("/api/input-invoices/{id}")
    public Item get(@PathVariable UUID id) {
        return service.get(id);
    }

    @GetMapping("/api/input-invoices/buyer-tax-codes")
    public List<String> buyerTaxCodes() {
        return service.buyerTaxCodes();
    }

    @GetMapping("/api/input-invoices/sellers")
    public List<Seller> sellers() {
        return service.sellers();
    }

    /** Nhập 1 hoặc nhiều file XML hóa đơn tải từ cổng thuế. */
    @PostMapping("/api/input-invoices/import")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public Map<String, Object> importXml(@RequestParam("files") List<MultipartFile> files) throws IOException {
        return service.importXml(files);
    }

    /** Gắn phiếu nhập đã lập (client cũ) = link type RECEIPT. */
    @PatchMapping("/api/input-invoices/{id}/receipt")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public void linkReceipt(@PathVariable UUID id, @RequestBody ReceiptLink link) {
        service.link(id, new Link("RECEIPT", link.receiptId(), link.receiptCode()));
    }

    /** Gắn chứng từ đã lập: phiếu nhập / phiếu chi NCC / phiếu chi Sổ quỹ ("Đã lập phiếu ↗"). */
    @PatchMapping("/api/input-invoices/{id}/link")
    @PreAuthorize("hasAuthority('inventory.manage') or hasAuthority('cashbook.manage')")
    public void link(@PathVariable UUID id, @Valid @RequestBody Link link) {
        service.link(id, link);
    }

    /** Chứng từ docId đã hủy → bỏ "Đã lập phiếu" của hóa đơn trỏ tới nó. */
    @DeleteMapping("/api/input-invoices/links/{docId}")
    @PreAuthorize("hasAuthority('inventory.manage') or hasAuthority('cashbook.manage')")
    public Map<String, Integer> unlink(@PathVariable UUID docId) {
        return Map.of("unlinked", service.unlinkDoc(docId));
    }

    @GetMapping("/api/input-invoices/item-mappings")
    public List<ItemMapping> mappings(@RequestParam String sellerTaxCode) {
        return service.mappings(sellerTaxCode);
    }

    @PutMapping("/api/input-invoices/item-mappings")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public void saveMappings(@Valid @RequestBody MappingRequest req, @AuthenticationPrincipal Jwt jwt) {
        service.saveMappings(req, UUID.fromString(jwt.getSubject()));
    }
}
