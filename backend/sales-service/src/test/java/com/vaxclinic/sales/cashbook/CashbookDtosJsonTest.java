package com.vaxclinic.sales.cashbook;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.sales.cashbook.CashbookDtos.Allocated;
import com.vaxclinic.sales.cashbook.CashbookDtos.BankAccountView;
import com.vaxclinic.sales.cashbook.CashbookDtos.CashVoucherView;
import com.vaxclinic.sales.cashbook.CashbookDtos.VietQr;
import com.vaxclinic.sales.cashbook.CashbookDtos.VoucherDetail;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Các record thay entity / Map ở CashbookController phải sinh JSON giống hệt trước đây. */
class CashbookDtosJsonTest {

    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    private JsonNode tree(Object o) {
        return json.valueToTree(o);
    }

    private static CashVoucher voucher() {
        var v = new CashVoucher();
        v.setId(UUID.randomUUID());
        v.setCode("PT000123");
        v.setVoucherType("RECEIPT");
        v.setFund("BANK");
        v.setBankAccountId(UUID.randomUUID());
        v.setCategory("Thu khác");
        v.setAmount(new BigDecimal("150000"));
        v.setOccurredAt(Instant.parse("2026-11-01T03:04:05.123Z"));
        v.setBranchId(UUID.randomUUID());
        v.setPartnerType("CUSTOMER");
        v.setPartnerId(UUID.randomUUID());
        v.setPartnerName("Nguyễn Văn A");
        v.setPartnerPhone(null);
        v.setCollectorId(UUID.randomUUID());
        v.setCollectorName("Thu ngân");
        v.setCreatedBy(UUID.randomUUID());
        v.setCreatedByName("Thu ngân");
        v.setAccounting(false);
        v.setAffectsDebt(true);
        v.setSourceId(null);
        v.setNote(null);
        return v;
    }

    private static BankAccount bank() {
        var b = new BankAccount();
        b.setId(UUID.randomUUID());
        b.setBankName("Vietcombank");
        b.setBankBin(null);
        b.setAccountNo("0123456789");
        b.setAccountName("NGUYEN VAN A");
        b.setActive(true);
        b.setKind("BANK");
        b.setNote(null);
        return b;
    }

    private static List<String> keys(JsonNode n) {
        var out = new ArrayList<String>();
        n.fieldNames().forEachRemaining(out::add);
        return out;
    }

    @Test
    void cashVoucherViewMatchesEntityJson() {
        CashVoucher v = voucher();
        JsonNode before = tree(v);
        JsonNode after = tree(CashVoucherView.of(v));
        assertThat(after).isEqualTo(before);
        assertThat(keys(after)).containsExactlyInAnyOrder("id", "code", "voucherType", "fund", "bankAccountId", "category",
                "amount", "occurredAt", "branchId", "partnerType", "partnerId", "partnerName", "partnerPhone", "collectorId",
                "collectorName", "createdBy", "createdByName", "accounting", "affectsDebt", "status", "sourceType", "sourceId",
                "note", "createdAt");
        assertThat(after.get("partnerPhone").isNull()).isTrue();
        assertThat(after.get("accounting").asBoolean()).isFalse();
        assertThat(after.get("affectsDebt").asBoolean()).isTrue();
        assertThat(after.get("amount").decimalValue()).isEqualByComparingTo("150000");
    }

    @Test
    void voucherDetailMatchesPreviousMap() {
        CashVoucher v = voucher();
        var allocations = List.of(new Allocated(UUID.randomUUID(), "HD000001", Instant.parse("2026-10-31T10:00:00Z"),
                new BigDecimal("200000"), new BigDecimal("150000")));
        JsonNode before = tree(Map.of("voucher", v, "allocations", allocations));
        JsonNode after = tree(new VoucherDetail(CashVoucherView.of(v), allocations));
        assertThat(after).isEqualTo(before);
        assertThat(keys(after)).containsExactlyInAnyOrder("voucher", "allocations");
    }

    @Test
    void bankAccountViewMatchesEntityJson() {
        BankAccount b = bank();
        JsonNode before = tree(b);
        JsonNode after = tree(BankAccountView.of(b));
        assertThat(after).isEqualTo(before);
        assertThat(keys(after)).containsExactlyInAnyOrder("id", "bankName", "bankBin", "accountNo", "accountName", "active",
                "kind", "note");
        assertThat(tree(List.of(BankAccountView.of(b)))).isEqualTo(tree(List.of(b)));
    }

    @Test
    void vietQrMatchesPreviousMap() {
        JsonNode before = tree(Map.of("payload", "000201...", "bankName", "Vietcombank", "accountNo", "0123",
                "accountName", "NGUYEN VAN A"));
        JsonNode after = tree(new VietQr("000201...", "Vietcombank", "0123", "NGUYEN VAN A"));
        assertThat(after).isEqualTo(before);
    }
}
