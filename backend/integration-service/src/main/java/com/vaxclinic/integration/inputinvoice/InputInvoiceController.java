package com.vaxclinic.integration.inputinvoice;

import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Item;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Page;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.ReceiptLink;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
 * Hóa đơn đầu vào → "Danh sách hóa đơn": lọc, xem chi tiết, nhập file XML, đánh dấu đã lập phiếu nhập.
 * Nghiệp vụ ở {@link InputInvoiceService}.
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
                     @RequestParam(required = false) String seller, @RequestParam(required = false) String receiptStatus,
                     @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "15") int size) {
        return service.list(from, to, q, buyerTaxCode, seller, receiptStatus, page, size);
    }

    @GetMapping("/api/input-invoices/{id}")
    public Item get(@PathVariable UUID id) {
        return service.get(id);
    }

    @GetMapping("/api/input-invoices/buyer-tax-codes")
    public List<String> buyerTaxCodes() {
        return service.buyerTaxCodes();
    }

    /** Nhập 1 hoặc nhiều file XML hóa đơn tải từ cổng thuế. */
    @PostMapping("/api/input-invoices/import")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public Map<String, Object> importXml(@RequestParam("files") List<MultipartFile> files) throws IOException {
        return service.importXml(files);
    }

    /** Gắn phiếu nhập đã lập từ hóa đơn này (trạng thái "Đã lập phiếu"). */
    @PatchMapping("/api/input-invoices/{id}/receipt")
    @PreAuthorize("hasAuthority('inventory.manage')")
    public void linkReceipt(@PathVariable UUID id, @RequestBody ReceiptLink link) {
        service.linkReceipt(id, link);
    }
}
