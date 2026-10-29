package com.vaxclinic.integration.inputinvoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Item;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Page;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.ReceiptLink;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Hóa đơn đầu vào → "Danh sách hóa đơn": lọc, xem chi tiết, nhập file XML, đánh dấu đã lập phiếu nhập. */
@Service
public class InputInvoiceService {

    private final InputInvoiceRepository invoices;
    private final InputInvoiceWriteRepository store;

    public InputInvoiceService(InputInvoiceRepository invoices, InputInvoiceWriteRepository store) {
        this.invoices = invoices;
        this.store = store;
    }

    public Page list(LocalDate from, LocalDate to, String q, String buyerTaxCode, String seller, String receiptStatus,
                     int page, int size) {
        return invoices.search(from, to, q, buyerTaxCode, seller, receiptStatus, page, size);
    }

    public Item get(UUID id) {
        return invoices.findById(id)
                .orElseThrow(() -> BusinessException.notFound("INPUT_INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn đầu vào"));
    }

    public List<String> buyerTaxCodes() {
        return invoices.findBuyerTaxCodes();
    }

    /** Nhập 1 hoặc nhiều file XML; file lỗi định dạng ghi vào "errors", không chặn các file khác. */
    public Map<String, Object> importXml(List<MultipartFile> files) throws IOException {
        int added = 0;
        var errors = new ArrayList<String>();
        for (MultipartFile f : files) {
            try {
                var parsed = EInvoiceXmlParser.parse(f.getBytes());
                if (store.upsert(parsed, parsed.buyerTaxCode() == null ? "" : parsed.buyerTaxCode(), "XML")) {
                    added++;
                }
            } catch (BusinessException e) {
                errors.add(f.getOriginalFilename() + ": " + e.getMessage());
            }
        }
        return Map.of("files", files.size(), "added", added, "errors", errors);
    }

    public void linkReceipt(UUID id, ReceiptLink link) {
        if (invoices.linkReceipt(id, link.receiptId(), link.receiptCode()) == 0) {
            throw BusinessException.notFound("INPUT_INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn đầu vào");
        }
    }
}
