package com.vaxclinic.sales.invoice;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** "Gộp đơn": hóa đơn cùng khách trong 7 ngày qua gộp thành 1 hóa đơn mới. */
public final class InvoiceMergeDtos {

    private InvoiceMergeDtos() {
    }

    /** Số ngày tính lùi từ hiện tại để tìm hóa đơn gộp được (như KiotViet). */
    public static final int WINDOW_DAYS = 7;

    /** id = id hóa đơn gộp mới do trình duyệt sinh: gửi lại cùng id (mạng chập chờn) không gộp 2 lần. */
    public record MergeRequest(@NotNull UUID id, @NotNull UUID branchId,
                               @NotNull @Size(min = 2, max = 50, message = "Chọn ít nhất 2 hóa đơn để gộp") List<UUID> invoiceIds) {
    }

    public record Candidate(UUID id, String code, Instant soldAt, BigDecimal total, BigDecimal paid, String customerCode,
                            String customerName) {
    }

    /** key = id khách (hoặc tên khách lẻ) — chỉ gộp được hóa đơn trong cùng 1 nhóm. */
    public record CandidateGroup(String key, String customerCode, String customerName, List<Candidate> invoices) {
    }

    /** reason khi không có nhóm nào: ORDER_NOT_COMPLETED (phiếu đặt hàng liên quan chưa hoàn thành) / NO_CANDIDATES. */
    public record CandidatesResponse(List<CandidateGroup> groups, String reason) {
    }

    /** 1 hóa đơn trong 7 ngày qua + các cờ chặn gộp (đọc từ DB). */
    public record Row(UUID id, String code, Instant soldAt, BigDecimal total, BigDecimal paid, UUID customerId,
                      String customerCode, String customerName, boolean hasReturn, boolean hasShipment, String orderStatus,
                      boolean foreignPayment) {

        public String groupKey() {
            return customerId != null ? customerId.toString()
                    : "walkin:" + (customerName == null ? "" : customerName.trim().toLowerCase());
        }

        public Candidate candidate() {
            return new Candidate(id, code, soldAt, total, paid, customerCode, customerName);
        }
    }
}
