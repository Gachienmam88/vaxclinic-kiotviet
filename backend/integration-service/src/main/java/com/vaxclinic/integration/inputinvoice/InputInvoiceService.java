package com.vaxclinic.integration.inputinvoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.integration.inputinvoice.InputInvoiceDtos.ImportResult;
import com.vaxclinic.integration.inputinvoice.InputInvoiceDtos.Item;
import com.vaxclinic.integration.inputinvoice.InputInvoiceDtos.Page;
import com.vaxclinic.integration.inputinvoice.InputInvoiceDtos.ReceiptLink;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Hóa đơn đầu vào → "Danh sách hóa đơn": lọc, xem chi tiết, nhập file XML, đánh dấu đã lập phiếu nhập. */
@Service
public class InputInvoiceService {

    private final InputInvoiceRepository repo;
    private final InputInvoiceStore store;

    public InputInvoiceService(InputInvoiceRepository repo, InputInvoiceStore store) {
        this.repo = repo;
        this.store = store;
    }

    public Page list(LocalDate from, LocalDate to, String q, String buyerTaxCode, String seller, String receiptStatus,
                     int page, int size) {
        return repo.search(from, to, q, buyerTaxCode, seller, receiptStatus, page, size);
    }

    public Item get(UUID id) {
        return repo.findById(id).stream().findFirst()
                .orElseThrow(() -> BusinessException.notFound("INPUT_INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn đầu vào"));
    }

    public List<String> buyerTaxCodes() {
        return repo.buyerTaxCodes();
    }

    /** Nhập 1 hoặc nhiều file XML hóa đơn tải từ cổng thuế. */
    public ImportResult importXml(List<MultipartFile> files) throws IOException {
        int added = 0;
        var errors = new java.util.ArrayList<String>();
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
        return new ImportResult(files.size(), added, errors);
    }

    /** Gắn phiếu nhập đã lập từ hóa đơn này (trạng thái "Đã lập phiếu"). */
    public void linkReceipt(UUID id, ReceiptLink link) {
        int n = repo.linkReceipt(id, link.receiptId(), link.receiptCode());
        if (n == 0) {
            throw BusinessException.notFound("INPUT_INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn đầu vào");
        }
    }
}
