package com.vaxclinic.sales.invoice;

import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceListItem;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Dữ liệu "Xuất file" danh sách hóa đơn — trình duyệt dựng file .xlsx theo các cột người dùng chọn. */
public final class InvoiceExportDtos {

    private InvoiceExportDtos() {
    }

    /** Tối đa số hóa đơn trong 1 lần xuất file. */
    public static final int MAX_INVOICES = 5000;

    /** Thanh toán tách theo hình thức + thông tin người nhận / kiện hàng của vận đơn hiện hành. */
    public record ExportExtra(UUID invoiceId, BigDecimal cash, BigDecimal card, BigDecimal transfer, BigDecimal ewallet,
                              String receiverName, String receiverPhone, String receiverAddress, String receiverArea,
                              String receiverProvinceCode, String receiverWardCode, String serviceType, Integer weightGram,
                              Integer lengthCm, Integer widthCm, Integer heightCm, String shipmentNote, String statusNote) {
    }

    public record ExportLine(UUID invoiceId, int lineNo, UUID productId, String productCode, String productName,
                             String unitName, BigDecimal quantity, BigDecimal unitPrice, BigDecimal discount,
                             BigDecimal price, BigDecimal amount, String lots, String note, String taxCode) {
    }

    /** detail = false → chỉ items (Xuất file tổng quan). */
    public record ExportResponse(List<InvoiceListItem> items, List<ExportExtra> extras, List<ExportLine> lines) {
    }
}
