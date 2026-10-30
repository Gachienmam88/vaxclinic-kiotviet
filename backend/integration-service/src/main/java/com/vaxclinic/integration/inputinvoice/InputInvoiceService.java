package com.vaxclinic.integration.inputinvoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Filter;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Item;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.ItemMapping;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Link;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.MappingRequest;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Page;
import com.vaxclinic.integration.inputinvoice.InputInvoiceModels.Seller;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Hóa đơn đầu vào → "Danh sách hóa đơn": lọc, xuất file, xem chi tiết, nhập file XML, gắn chứng từ đã lập
 * (phiếu nhập / phiếu chi), ghi nhớ ánh xạ hàng trên hóa đơn → hàng hóa trong kho.
 */
@Service
public class InputInvoiceService {

    /** Xuất file tối đa 5.000 hóa đơn / lần (như xuất hóa đơn / đặt hàng). */
    static final int EXPORT_MAX = 5000;

    private final InputInvoiceRepository invoices;
    private final InputInvoiceWriteRepository store;
    private final InputInvoiceMappingRepository mappings;

    public InputInvoiceService(InputInvoiceRepository invoices, InputInvoiceWriteRepository store,
                               InputInvoiceMappingRepository mappings) {
        this.invoices = invoices;
        this.store = store;
        this.mappings = mappings;
    }

    public Page list(Filter f, int page, int size) {
        return invoices.search(f, page, size);
    }

    public List<Item> export(Filter f) {
        return invoices.export(f, EXPORT_MAX);
    }

    public Item get(UUID id) {
        return invoices.findById(id)
                .orElseThrow(() -> BusinessException.notFound("INPUT_INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn đầu vào"));
    }

    public List<String> buyerTaxCodes() {
        return invoices.findBuyerTaxCodes();
    }

    public List<Seller> sellers() {
        return invoices.findSellers();
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

    /**
     * Gắn chứng từ đã lập ("Đã lập phiếu ↗"). Gắn lại đúng chứng từ cũ = không đổi (Lưu tạm rồi Hoàn thành cùng phiếu);
     * hóa đơn đã lập chứng từ KHÁC → 409 (tránh lập 2 phiếu từ 1 hóa đơn; hủy chứng từ cũ để bỏ liên kết).
     */
    @Transactional
    public void link(UUID id, Link link) {
        Object[] cur = invoices.findLink(id)
                .orElseThrow(() -> BusinessException.notFound("INPUT_INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn đầu vào"));
        if (cur[1] != null && !Objects.equals(cur[1], link.id())) {
            throw BusinessException.conflict("INPUT_INVOICE_LINKED", "Hóa đơn đã lập phiếu " + cur[2]);
        }
        invoices.setLink(id, link.type(), link.id(), link.code().trim());
    }

    /** Chứng từ đã lập bị hủy → hóa đơn trở về "Chưa lập phiếu" (idempotent). */
    public int unlinkDoc(UUID docId) {
        return invoices.unlinkDoc(docId);
    }

    public List<ItemMapping> mappings(String sellerTaxCode) {
        return mappings.find(sellerTaxCode.trim());
    }

    @Transactional
    public void saveMappings(MappingRequest req, UUID userId) {
        req.items().forEach(m -> mappings.upsert(req.sellerTaxCode().trim(), m, userId));
    }
}
