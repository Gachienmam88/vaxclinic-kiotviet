package com.vaxclinic.integration.einvoice;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Dựng body gửi MISA meInvoice "hóa đơn khởi tạo từ máy tính tiền" (POST .../invoice-calculating/invoiceandpublish).
 * Tên trường theo tài liệu doc.meinvoice.vn (InvoicePublishCalculatingMachine).
 *
 * Quy ước tiền: giá bán trong hệ thống là giá KHÁCH TRẢ (đã gồm thuế nếu có).
 *   tiền dòng (sau giảm giá) = SL × (đơn giá − giảm giá/đv) − phần giảm giá hóa đơn phân bổ theo tỷ lệ (dư dồn dòng cuối)
 *   tiền trước thuế = làm_tròn(tiền dòng / (1 + thuế suất));  tiền thuế = tiền dòng − tiền trước thuế
 * → Σ tiền dòng luôn đúng bằng "Khách cần trả" của hóa đơn.
 */
public final class MisaInvoicePayload {

    public record Source(String code, Instant soldAt, String paymentMethod, BigDecimal discount, BigDecimal total,
                         String buyerCode, String buyerFullName, String buyerLegalName, String buyerTaxCode,
                         String buyerAddress, String buyerEmail, String buyerPhone, List<SourceLine> lines) {
    }

    /** taxReduced: dòng giảm thuế 10% → 8% (Nghị quyết 204/2025/QH15) — giá bán gồm 10%, thuế xuất 8%. */
    public record SourceLine(String code, String name, String unit, BigDecimal quantity, BigDecimal unitPrice,
                             BigDecimal discount, String taxCode, boolean taxReduced) {
        public SourceLine(String code, String name, String unit, BigDecimal quantity, BigDecimal unitPrice, BigDecimal discount,
                          String taxCode) {
            this(code, name, unit, quantity, unitPrice, discount, taxCode, false);
        }
    }

    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    private MisaInvoicePayload() {
    }

    /** Mã thuế suất nội bộ → VATRateName của MISA. Hộ kinh doanh (KCT GTGT, 1,5% TNCN) → "KCT". */
    static String vatRateName(String taxCode) {
        if (taxCode == null) {
            return "KCT";
        }
        return switch (taxCode) {
            case "VAT0" -> "0%";
            case "VAT5" -> "5%";
            case "VAT8" -> "8%";
            case "VAT10" -> "10%";
            case "KKKNT" -> "KKKNT";
            default -> "KCT";
        };
    }

    static BigDecimal rateOf(String vatRateName) {
        return vatRateName.endsWith("%") ? new BigDecimal(vatRateName.replace("%", "")) : BigDecimal.ZERO;
    }

    public static Map<String, Object> build(Source s, UUID refId, String series, String invoiceName, boolean sendEmail) {
        BigDecimal gross = s.lines().stream().map(l -> l.quantity().multiply(l.unitPrice().subtract(l.discount())))
                .reduce(BigDecimal.ZERO, BigDecimal::add).setScale(0, RoundingMode.HALF_UP);
        BigDecimal invDiscount = s.discount() == null ? BigDecimal.ZERO : s.discount();
        var details = new ArrayList<Map<String, Object>>();
        Map<String, BigDecimal[]> byRate = new LinkedHashMap<>(); // VATRateName → [trước thuế, thuế]
        BigDecimal allocatedSoFar = BigDecimal.ZERO;
        BigDecimal saleTotal = BigDecimal.ZERO;
        for (int i = 0; i < s.lines().size(); i++) {
            var l = s.lines().get(i);
            BigDecimal lineGross = l.quantity().multiply(l.unitPrice().subtract(l.discount())).setScale(0, RoundingMode.HALF_UP);
            BigDecimal share = i == s.lines().size() - 1 ? invDiscount.subtract(allocatedSoFar)
                    : gross.signum() == 0 ? BigDecimal.ZERO : invDiscount.multiply(lineGross).divide(gross, 0, RoundingMode.HALF_UP);
            allocatedSoFar = allocatedSoFar.add(share);
            BigDecimal amount = lineGross.subtract(share);
            boolean reduced = l.taxReduced() && "VAT10".equals(l.taxCode());
            String rateName = reduced ? "8%" : vatRateName(l.taxCode());
            BigDecimal rate = rateOf(rateName);
            BigDecimal withoutVat = amount.multiply(BigDecimal.valueOf(100))
                    .divide(BigDecimal.valueOf(100).add(reduced ? BigDecimal.TEN : rate), 0, RoundingMode.HALF_UP);
            if (reduced) { // giá gồm 10% → trước thuế giữ nguyên, thuế 8%
                amount = withoutVat.add(withoutVat.multiply(rate).divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP));
            }
            BigDecimal vat = amount.subtract(withoutVat);
            BigDecimal lineDiscount = l.quantity().multiply(l.discount()).add(share).setScale(0, RoundingMode.HALF_UP);
            saleTotal = saleTotal.add(l.quantity().multiply(l.unitPrice()).setScale(0, RoundingMode.HALF_UP));
            var d = new LinkedHashMap<String, Object>();
            d.put("ItemType", 1);
            d.put("LineNumber", i + 1);
            d.put("SortOrder", i + 1);
            d.put("ItemCode", l.code());
            d.put("ItemName", l.name());
            d.put("UnitName", l.unit());
            d.put("Quantity", l.quantity());
            d.put("UnitPrice", l.unitPrice());
            d.put("DiscountAmountOC", lineDiscount);
            d.put("DiscountAmount", lineDiscount);
            d.put("AmountOC", l.quantity().multiply(l.unitPrice()).setScale(0, RoundingMode.HALF_UP));
            d.put("Amount", l.quantity().multiply(l.unitPrice()).setScale(0, RoundingMode.HALF_UP));
            d.put("AmountWithoutVATOC", withoutVat);
            d.put("AmountWithoutVAT", withoutVat);
            d.put("VATRateName", rateName);
            d.put("VATAmountOC", vat);
            d.put("VATAmount", vat);
            d.put("AmountAfterTax", amount);
            details.add(d);
            byRate.computeIfAbsent(rateName, k -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
            byRate.get(rateName)[0] = byRate.get(rateName)[0].add(withoutVat);
            byRate.get(rateName)[1] = byRate.get(rateName)[1].add(vat);
        }
        BigDecimal totalWithoutVat = byRate.values().stream().map(v -> v[0]).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalVat = byRate.values().stream().map(v -> v[1]).reduce(BigDecimal.ZERO, BigDecimal::add);
        var taxInfo = byRate.entrySet().stream().map(e -> Map.<String, Object>of("VATRateName", e.getKey(),
                "AmountWithoutVATOC", e.getValue()[0], "VATAmountOC", e.getValue()[1])).toList();

        var inv = new LinkedHashMap<String, Object>();
        inv.put("RefID", refId.toString());
        inv.put("InvSeries", series);
        inv.put("InvoiceName", invoiceName);
        inv.put("InvDate", s.soldAt().atZone(VN).toLocalDate().toString());
        inv.put("IsInvoiceCalculatingMachine", true);
        inv.put("CurrencyCode", "VND");
        inv.put("ExchangeRate", 1);
        inv.put("PaymentMethodName", paymentName(s.paymentMethod()));
        inv.put("BuyerCode", s.buyerCode());
        inv.put("BuyerFullName", s.buyerFullName());
        inv.put("BuyerLegalName", s.buyerLegalName());
        inv.put("BuyerTaxCode", s.buyerTaxCode());
        inv.put("BuyerAddress", s.buyerAddress());
        inv.put("BuyerEmail", s.buyerEmail());
        inv.put("BuyerPhoneNumber", s.buyerPhone());
        inv.put("ContactName", s.buyerFullName());
        inv.put("TotalSaleAmountOC", saleTotal);
        inv.put("TotalSaleAmount", saleTotal);
        inv.put("TotalAmountWithoutVATOC", totalWithoutVat);
        inv.put("TotalAmountWithoutVAT", totalWithoutVat);
        inv.put("TotalVATAmountOC", totalVat);
        inv.put("TotalVATAmount", totalVat);
        inv.put("TotalAmountOC", s.total());
        inv.put("TotalAmount", s.total());
        inv.put("TotalAmountInWords", VietnameseAmountInWords.of(s.total().longValue()));
        inv.put("OriginalInvoiceDetail", details);
        inv.put("TaxRateInfo", taxInfo);
        inv.put("OptionUserDefined", Map.of("MainCurrency", "VND", "AmountDecimalDigits", "0", "AmountOCDecimalDigits", "0",
                "UnitPriceDecimalDigits", "0", "UnitPriceOCDecimalDigits", "0", "QuantityDecimalDigits", "0",
                "CoefficientDecimalDigits", "2", "ExchangRateDecimalDigits", "0"));

        var item = new LinkedHashMap<String, Object>();
        item.put("OrgInvoiceData", inv);
        item.put("IsSendEmail", sendEmail && s.buyerEmail() != null);
        item.put("ReceiverName", s.buyerFullName());
        item.put("ReceiverEmail", s.buyerEmail());
        return item;
    }

    static String paymentName(String method) {
        if (method == null) {
            return "TM/CK";
        }
        return switch (method) {
            case "CASH" -> "Tiền mặt";
            case "TRANSFER" -> "Chuyển khoản";
            case "CARD" -> "Thẻ";
            default -> "TM/CK";
        };
    }
}
