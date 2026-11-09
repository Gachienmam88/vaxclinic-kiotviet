package com.vaxclinic.integration.payment;

import com.vaxclinic.integration.payment.SePayDtos.BankTransaction;
import com.vaxclinic.integration.payment.SePayDtos.PaymentRequestResponse;
import com.vaxclinic.integration.payment.SePayDtos.SettingsResponse;
import com.vaxclinic.integration.payment.SePayDtos.WebhookResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.vaxclinic.integration.JsonShape.assertSameJson;
import static com.vaxclinic.integration.JsonShape.row;

/** JSON của record mới = JSON của Map trả về trước đây (SePayController). */
class SePayDtosJsonTest {

    private static Map<String, Object> oldSettings(boolean enabled, boolean configured, boolean autoComplete) {
        var out = new HashMap<String, Object>();
        out.put("enabled", enabled);
        out.put("configured", configured);
        out.put("autoComplete", autoComplete);
        return out;
    }

    @Test
    void settings() {
        assertSameJson(oldSettings(false, false, true), new SettingsResponse(false, false, true));
        assertSameJson(oldSettings(true, true, false), new SettingsResponse(true, true, false));
    }

    @Test
    void webhookBody() {
        assertSameJson(Map.of("success", true), new WebhookResponse(true));
        assertSameJson(Map.of("success", false), new WebhookResponse(false));
    }

    @Test
    void paymentRequest() {
        var r = row("code", "VXCABCDEFGH", "amount", new BigDecimal("150000"), "paid_amount", new BigDecimal("0"),
                "status", "PENDING", "paid_at", null);
        Map<String, Object> old = Map.of("code", r.get("code"), "amount", r.get("amount"), "paidAmount", r.get("paid_amount"),
                "status", r.get("status"), "autoComplete", true);
        assertSameJson(old, new PaymentRequestResponse((String) r.get("code"), (BigDecimal) r.get("amount"),
                (BigDecimal) r.get("paid_amount"), (String) r.get("status"), true));
    }

    @Test
    void transactions() {
        var full = row("sepay_id", 92704L, "gateway", "Vietcombank", "transaction_date", "2026-10-29 10:00:00",
                "account_number", "0071000", "transfer_type", "in", "amount", new BigDecimal("2277000"),
                "content", "VXCABCDEFGH chuyen tien", "reference_code", "MBVCB.1", "payment_code", "VXCABCDEFGH",
                "received_at", Timestamp.from(Instant.parse("2026-10-29T03:00:00.5Z")));
        var nulls = row("sepay_id", 1L, "gateway", null, "transaction_date", null, "account_number", null,
                "transfer_type", "out", "amount", new BigDecimal("1000"), "content", null, "reference_code", null,
                "payment_code", null, "received_at", Timestamp.from(Instant.parse("2026-10-29T03:00:00Z")));
        assertSameJson(List.of(full, nulls), List.of(BankTransaction.fromRow(full), BankTransaction.fromRow(nulls)));
    }
}
