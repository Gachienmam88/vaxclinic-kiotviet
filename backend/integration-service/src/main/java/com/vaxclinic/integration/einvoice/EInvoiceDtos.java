package com.vaxclinic.integration.einvoice;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.sql.Timestamp;
import java.util.Map;
import java.util.UUID;

/** Request / response của API hóa đơn điện tử (MISA meInvoice). */
public final class EInvoiceDtos {

    private EInvoiceDtos() {
    }

    public record SettingsRequest(@Pattern(regexp = "TEST|PROD") String environment, @NotBlank(message = "Nhập AppID MISA cấp") String appId,
                                  @NotBlank(message = "Nhập mã số thuế") String taxCode, @NotBlank String username, String password,
                                  @NotBlank(message = "Nhập ký hiệu hóa đơn") String invSeries, @NotBlank String invoiceName,
                                  boolean sendEmail) {
    }

    /** POST /api/einvoice/settings/test. */
    public record OkResponse(boolean ok) {
    }

    /** GET /internal/einvoices/{invoiceId}/published. */
    public record PublishedResponse(boolean published) {
    }

    /** GET /internal/einvoices/statuses: invoiceId dạng chuỗi; status ACCEPTED / PUBLISHED / FAILED. */
    public record InvoiceStatus(String invoiceId, String status) {
    }

    /**
     * GET /api/einvoices: 1 dòng einvoice_records — tên khóa JSON = tên cột (snake_case) và kiểu giá trị = kiểu JDBC
     * (updated_at: java.sql.Timestamp) như khi trả thẳng dòng queryForList trước đây.
     */
    public record RecordStatus(@JsonProperty("invoice_id") UUID invoiceId, @JsonProperty("invoice_code") String invoiceCode,
                               @JsonProperty("status") String status, @JsonProperty("inv_series") String invSeries,
                               @JsonProperty("inv_no") String invNo, @JsonProperty("inv_code") String invCode,
                               @JsonProperty("inv_date") String invDate, @JsonProperty("transaction_id") String transactionId,
                               @JsonProperty("error") String error, @JsonProperty("updated_at") Timestamp updatedAt) {

        /** Từ 1 dòng queryForList (giữ nguyên giá trị JDBC). */
        public static RecordStatus fromRow(Map<String, Object> row) {
            return new RecordStatus((UUID) row.get("invoice_id"), (String) row.get("invoice_code"), (String) row.get("status"),
                    (String) row.get("inv_series"), (String) row.get("inv_no"), (String) row.get("inv_code"),
                    (String) row.get("inv_date"), (String) row.get("transaction_id"), (String) row.get("error"),
                    (Timestamp) row.get("updated_at"));
        }
    }
}
