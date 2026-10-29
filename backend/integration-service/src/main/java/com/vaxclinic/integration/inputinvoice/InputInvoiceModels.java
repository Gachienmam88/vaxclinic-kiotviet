package com.vaxclinic.integration.inputinvoice;

import com.fasterxml.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** DTO của API hóa đơn đầu vào (/api/input-invoices). */
public final class InputInvoiceModels {

    private InputInvoiceModels() {
    }

    public record Item(UUID id, String buyerTaxCode, String sellerTaxCode, String sellerName, String templateNo,
                       String series, String number, LocalDate issuedAt, BigDecimal totalBeforeTax, BigDecimal vatAmount,
                       BigDecimal total, String nature, String source, UUID receiptId, String receiptCode, JsonNode lines) {
    }

    public record Page(List<Item> items, long total, BigDecimal sumTotal) {
    }

    public record ReceiptLink(UUID receiptId, String receiptCode) {
    }
}
