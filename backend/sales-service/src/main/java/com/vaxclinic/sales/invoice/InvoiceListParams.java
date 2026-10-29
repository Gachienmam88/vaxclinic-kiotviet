package com.vaxclinic.sales.invoice;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Bộ lọc danh sách hóa đơn nhận từ query string (cùng tên tham số với GET /api/invoices) — dùng cho "Xuất file"
 * để file luôn khớp đúng bộ lọc sidebar + ô tìm kiếm đang chọn (mọi trang, không chỉ trang đang xem).
 */
public record InvoiceListParams(String q, List<String> statuses, Instant from, Instant to, UUID createdBy, UUID sellerId,
                                List<String> paymentMethods, UUID customerId, UUID branchId, List<UUID> ids,
                                List<String> states, List<String> deliveries, List<String> returnStates,
                                List<String> einvoiceStatuses, List<String> einvoiceNatures, String customerQ,
                                String productQ, String noteQ) {

    /** branches: phạm vi chi nhánh người xem (BranchScope). */
    public InvoiceQuery.Filter toFilter(int page, int size, List<UUID> branches) {
        return new InvoiceQuery.Filter(q, statuses, from, to, createdBy, sellerId, paymentMethods, customerId, branchId,
                page, size, ids, states, deliveries, returnStates, einvoiceStatuses, einvoiceNatures, customerQ, productQ, noteQ,
                branches);
    }
}
