package com.vaxclinic.sales.invoice;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * "Import file" danh sách hóa đơn (file mẫu KiotViet). Trình duyệt đọc file .xlsx / .csv thành các dòng chữ (giữ số dòng
 * Excel); các dòng cùng Mã hóa đơn = 1 hóa đơn, thông tin hóa đơn / khách / thanh toán lấy ở dòng đầu tiên của mã đó.
 */
public final class InvoiceImportDtos {

    private InvoiceImportDtos() {
    }

    public static final int MAX_ROWS = 2000;

    /** 1 dòng của file, mọi ô là chữ như người dùng nhập (số kiểu 100,000 / 100000; ngày dd/MM/yyyy [HH:mm]). */
    public record ImportRow(int line, String code, String time, String seller, String channel, String customerCode,
                            String customerName, String phone, String email, String address, String area, String ward,
                            String priceBook, String productCode, String quantity, String lot, String expiry, String price,
                            String discountPercent, String discount, String invoiceDiscount, String invoiceDiscountPercent,
                            String cash, String card, String transfer, String note) {
    }

    /** id: do trình duyệt sinh cho 1 lần import — gửi lại cùng id không tạo trùng hóa đơn đã import. */
    public record ImportRequest(@NotNull UUID id, @NotNull UUID branchId,
                                @NotEmpty(message = "File không có dòng dữ liệu nào")
                                @Size(max = MAX_ROWS, message = "Tối đa 2000 dòng mỗi lần import") @Valid List<ImportRow> rows) {
    }

    public record ImportError(int line, String message) {
    }

    public record Created(UUID id, String code) {
    }

    /**
     * Có lỗi kiểm tra → errors, không lưu gì. Hợp lệ → tạo lần lượt từng hóa đơn (mỗi hóa đơn 1 transaction); lỗi bất ngờ
     * giữa chừng (VD: vừa có người bán hết lô) → failed = dòng lỗi, các hóa đơn trước đó đã lưu nằm trong created.
     * skipped = hóa đơn đã import ở lần gửi trước cùng id.
     */
    public record ImportResult(int invoices, List<Created> created, int skipped, List<ImportError> errors, ImportError failed) {
    }

    /** Kết quả kiểm tra 1 dòng hàng. lot = null với hàng không theo lô. */
    record PlannedLine(int line, InvoiceImportLookupClient.Product product, InvoiceImportLookupClient.Unit unit,
                       BigDecimal quantity, BigDecimal price, BigDecimal discount, String lot) {
    }

    /** customerId = khách có sẵn; newCustomer = cần tạo (mã / tên / điện thoại...); cả hai null = khách lẻ. */
    record PlannedInvoice(UUID id, String code, int line, Instant soldAt, UUID sellerId, String sellerName,
                          String channel, UUID customerId, ImportRow newCustomer, UUID priceBookId, String priceBookName,
                          List<PlannedLine> lines, BigDecimal discount, BigDecimal cash, BigDecimal card, BigDecimal transfer,
                          String note, boolean alreadyImported) {
    }
}
