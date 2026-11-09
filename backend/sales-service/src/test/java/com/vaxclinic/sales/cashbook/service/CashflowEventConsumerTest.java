package com.vaxclinic.sales.cashbook.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CashflowEventConsumerTest {

    /** Sổ quỹ giả: ghi lại bản tin nhận được; fail = mô phỏng DB lỗi. */
    static class FakeCashbook extends CashbookService {
        final List<InboundCashflow> received = new ArrayList<>();
        boolean fail;

        FakeCashbook() {
            super(null, null, null, null, null);
        }

        @Override
        public void inbound(InboundCashflow in) {
            if (fail) {
                throw new IllegalStateException("db down");
            }
            received.add(in);
        }
    }

    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    private static ConsumerRecord<String, String> record(String value) {
        return new ConsumerRecord<>("cashflow.events", 0, 0L, "k", value);
    }

    @Test
    void outboxPayloadBecomesCashbookInbound() {
        var cashbook = new FakeCashbook();
        UUID receipt = UUID.randomUUID();
        // đúng dạng JSON mà CashflowOutbox.receiptPaid ghi vào outbox
        String payload = """
                {"action":"CREATE","sourceType":"PURCHASE","sourceId":"%s","code":"PCPN000001","voucherType":"PAYMENT",
                 "fund":"CASH","category":"Chi Tiền trả NCC","amount":5000000,"occurredAt":"2026-11-10T03:00:00Z",
                 "branchId":"00000000-0000-0000-0000-000000000001","partnerType":"SUPPLIER","partnerName":"NCC A",
                 "userName":"admin","note":"Thanh toán phiếu nhập PN000001"}""".formatted(receipt);

        new CashflowEventConsumer(cashbook, json).onMessage(record(payload));

        var in = cashbook.received.get(0);
        assertEquals("CREATE", in.action());
        assertEquals(receipt, in.sourceId());
        assertEquals("PCPN000001", in.code());
        assertEquals(0, new BigDecimal("5000000").compareTo(in.amount()));
        assertEquals(Instant.parse("2026-11-10T03:00:00Z"), in.occurredAt());
    }

    @Test
    void malformedJsonIsSkipped() {
        var cashbook = new FakeCashbook();
        new CashflowEventConsumer(cashbook, json).onMessage(record("{oops"));
        assertTrue(cashbook.received.isEmpty());
    }

    @Test
    void cashbookErrorIsRethrownSoKafkaRetries() {
        var cashbook = new FakeCashbook();
        cashbook.fail = true;
        var consumer = new CashflowEventConsumer(cashbook, json);
        assertThrows(IllegalStateException.class,
                () -> consumer.onMessage(record("{\"action\":\"CANCEL\",\"sourceType\":\"PURCHASE\",\"sourceId\":\"" + UUID.randomUUID() + "\"}")));
    }
}
