package com.vaxclinic.integration.inputinvoice;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** DTO của API hóa đơn đầu vào (/api/input-invoices). */
public final class InputInvoiceModels {

    private InputInvoiceModels() {
    }

    /**
     * linkType/linkId/linkCode = chứng từ đã lập từ hóa đơn (RECEIPT phiếu nhập, SUPPLIER_PAYMENT phiếu chi NCC PCN,
     * CASH_VOUCHER phiếu chi Sổ quỹ). receiptId/receiptCode giữ cho client cũ (= link khi là phiếu nhập).
     * details / totalInWords chỉ có ở GET /{id} (danh sách trả null).
     */
    public record Item(UUID id, String buyerTaxCode, String sellerTaxCode, String sellerName, String sellerAddress,
                       String templateNo, String series, String number, LocalDate issuedAt, BigDecimal totalBeforeTax,
                       BigDecimal vatAmount, BigDecimal total, String nature, String source, String linkType, UUID linkId,
                       String linkCode, UUID receiptId, String receiptCode, JsonNode lines, JsonNode details,
                       String totalInWords) {
    }

    public record Page(List<Item> items, long total, BigDecimal sumTotal) {
    }

    /** Bộ lọc danh sách / xuất file. natures rỗng = mọi tính chất; receiptStatus CREATED / NOT_CREATED / khác = tất cả. */
    public record Filter(LocalDate from, LocalDate to, String q, String buyerTaxCode, String seller, String sellerTaxCode,
                         List<String> natures, String receiptStatus) {
    }

    public record ReceiptLink(UUID receiptId, String receiptCode) {
    }

    public record Link(@NotBlank @Pattern(regexp = "RECEIPT|SUPPLIER_PAYMENT|CASH_VOUCHER") String type,
                       @NotNull UUID id, @NotBlank @Size(max = 30) String code) {
    }

    public record Seller(String taxCode, String name) {
    }

    /** Hàng trên hóa đơn của NCC (tên + ĐVT) ↔ hàng hóa + đơn vị trong kho. */
    public record ItemMapping(@NotBlank @Size(max = 500) String itemName, @Size(max = 50) String itemUnit,
                              @NotNull UUID productId, @NotNull UUID unitId) {
    }

    public record MappingRequest(@NotBlank @Size(max = 20) String sellerTaxCode, @Valid @NotNull List<ItemMapping> items) {
    }
}
