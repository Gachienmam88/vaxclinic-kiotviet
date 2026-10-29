package com.vaxclinic.sales.invoice.checkout;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.notification.NotificationClient;
import com.vaxclinic.common.notification.NotificationClient.Item;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.invoice.InvoiceDtos.InvoiceRequest;
import com.vaxclinic.sales.invoice.InvoiceDtos.LineInput;
import com.vaxclinic.sales.invoice.ProductStockClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Luồng "kho đã trừ, lưu hóa đơn lỗi, máy bán hàng không gửi lại" với kho giả (chống trùng (docId, docType) giống
 * product-service) và bảng checkout_attempts trong RAM — không cần DB / HTTP, không có móc test trong code chạy thật.
 */
class CheckoutCompensationFlowTest {

    private static final UUID BRANCH = UUID.randomUUID();
    private static final Actor ACTOR = new Actor(UUID.randomUUID(), "Thu ngân", List.of(BRANCH.toString()));

    private FakeCheckoutAttemptRepository attempts;
    private FakeStock stock;
    private CheckoutAttemptService service;
    private CheckoutReconciler reconciler;
    private final List<Item> published = new ArrayList<>();

    @BeforeEach
    void setUp() {
        attempts = new FakeCheckoutAttemptRepository();
        stock = new FakeStock(10);
        service = new CheckoutAttemptService(attempts, new ObjectMapper().registerModule(new JavaTimeModule()));
        NotificationClient inbox = new NotificationClient(null, null) {
            @Override
            public boolean publish(List<Item> items) {
                published.addAll(items);
                return true;
            }
        };
        reconciler = new CheckoutReconciler(attempts, stock, new TransactionTemplate(new NoOpTransactionManager()),
                new CheckoutCompensationNotifier(inbox));
    }

    @Test
    void abandonedCheckoutIsCompensatedAndRetryDeductsAgainExactlyOnce() {
        InvoiceRequest req = request();
        // 1) trừ kho OK, "lưu hóa đơn" lỗi (không gọi markDone) — máy bán hàng bỏ đi
        UUID doc1 = service.begin(req, "HD000001", "Khách lẻ", ACTOR, BigDecimal.TEN);
        stock.apply(sale(doc1));
        assertThat(stock.quantity).isEqualTo(9);

        // 2) chưa quá 5 phút: job không đụng tới
        assertThat(reconciler.run()).isZero();
        assertThat(stock.quantity).isEqualTo(9);

        // 3) quá 5 phút, không có hóa đơn → hoàn kho, COMPENSATED
        attempts.age(req.id(), Duration.ofMinutes(6));
        assertThat(reconciler.run()).isEqualTo(1);
        assertThat(stock.quantity).isEqualTo(10);
        assertThat(attempts.get(req.id()).status()).isEqualTo(CheckoutAttempt.COMPENSATED);
        assertThat(published).singleElement().satisfies(it -> {
            assertThat(it.type()).isEqualTo("CHECKOUT_COMPENSATED");
            assertThat(it.dedupeKey()).isEqualTo("checkout_compensated:" + req.id() + ":1");
            assertThat(it.branchId()).isEqualTo(BRANCH);
            assertThat(it.permission()).isEqualTo("sales.perform");
            assertThat(it.docCode()).isNull();
            assertThat(it.body()).startsWith("Lần thanh toán " + req.id().toString().substring(0, 8) + " lúc ")
                    .endsWith(" không lưu được hóa đơn — đã hoàn kho tự động. Kiểm tra lại với thu ngân.")
                    .matches("Lần thanh toán [0-9a-f]{8} lúc [0-9]{2}:[0-9]{2} [0-9]{2}/[0-9]{2}/[0-9]{4} .*");
        });

        // Lý do phải đổi chứng từ kho: gửi lại SALE cùng doc1 bị product-service coi là trùng → KHÔNG trừ kho
        stock.apply(sale(doc1));
        assertThat(stock.quantity).isEqualTo(10);

        // 4) máy bán hàng gửi lại cùng id hóa đơn → round 2, chứng từ kho mới → trừ đúng 1 lần, lưu hóa đơn được
        UUID doc2 = service.begin(req, "HD000002", "Khách lẻ", ACTOR, BigDecimal.TEN);
        assertThat(doc2).isNotEqualTo(doc1);
        stock.apply(sale(doc2));
        stock.apply(sale(doc2)); // gửi lại lần nữa trong cùng round: idempotent
        assertThat(stock.quantity).isEqualTo(9);
        assertThat(service.markDone(req.id(), doc2)).isTrue();

        // 5) job chạy tiếp: DONE → không làm gì
        attempts.age(req.id(), Duration.ofMinutes(10));
        assertThat(reconciler.run()).isZero();
        assertThat(stock.quantity).isEqualTo(9);
    }

    @Test
    void lateInvoicePersistLosesToCompensationAndRollsBack() {
        InvoiceRequest req = request();
        UUID doc1 = service.begin(req, "HD000003", "Khách lẻ", ACTOR, BigDecimal.TEN);
        stock.apply(sale(doc1));
        attempts.age(req.id(), Duration.ofMinutes(6));
        reconciler.run();
        // InvoiceWriter.persist gọi markDone trong transaction ghi hóa đơn: false → rollback, không có HĐ thiếu kho
        assertThat(service.markDone(req.id(), doc1)).isFalse();
    }

    @Test
    void retryDuringCompensationGetsConflictAndStockFailureIsNotCompensated() {
        InvoiceRequest req = request();
        UUID doc1 = service.begin(req, "HD000004", "Khách lẻ", ACTOR, BigDecimal.TEN);
        stock.apply(sale(doc1));
        attempts.age(req.id(), Duration.ofMinutes(6));
        stock.down = true; // product-service không phản hồi lúc hoàn kho → giữ COMPENSATING
        assertThat(reconciler.run()).isZero();
        assertThat(attempts.get(req.id()).status()).isEqualTo(CheckoutAttempt.COMPENSATING);
        assertThatThrownBy(() -> service.begin(req, "HD000005", "Khách lẻ", ACTOR, BigDecimal.TEN))
                .isInstanceOf(BusinessException.class).hasMessageContaining("đối soát");
        stock.down = false;
        attempts.age(req.id(), Duration.ofMinutes(6));
        assertThat(reconciler.run()).isEqualTo(1);
        assertThat(stock.quantity).isEqualTo(10);

        // Kho từ chối ngay (FAILED) → không có gì để hoàn
        InvoiceRequest other = request();
        service.begin(other, "HD000006", "Khách lẻ", ACTOR, BigDecimal.TEN);
        service.markFailed(other.id(), "INSUFFICIENT_STOCK");
        attempts.age(other.id(), Duration.ofHours(1));
        assertThat(reconciler.run()).isZero();
        assertThat(stock.quantity).isEqualTo(10);
        assertThat(published).hasSize(1); // chỉ lần hoàn kho thật của req; FAILED không báo
    }

    @Test
    void nothingDeductedIsClosedWithoutInboxAlert() {
        InvoiceRequest req = request();
        service.begin(req, "HD000007", "Khách lẻ", ACTOR, BigDecimal.TEN); // lỗi trước khi tới product-service
        attempts.age(req.id(), Duration.ofMinutes(6));
        assertThat(reconciler.run()).isEqualTo(1);
        assertThat(attempts.get(req.id()).status()).isEqualTo(CheckoutAttempt.COMPENSATED);
        assertThat(published).isEmpty();
    }

    private static InvoiceRequest request() {
        var line = new LineInput(UUID.randomUUID(), UUID.randomUUID(), "SP01", "Vắc xin cúm", "Liều", BigDecimal.ONE,
                BigDecimal.TEN, null, null, null, null);
        return new InvoiceRequest(UUID.randomUUID(), BRANCH, null, null, null, null, "QUICK", null, null, "CASH", null,
                null, false, List.of(line), null, null, null, null, null, null, null, null, null);
    }

    private static ProductStockClient.Request sale(UUID docId) {
        return new ProductStockClient.Request(docId, "SALE", "HD", BRANCH, "Khách lẻ", ACTOR.id(), null, List.of());
    }

    private static final class NoOpTransactionManager implements PlatformTransactionManager {
        @Override
        public TransactionStatus getTransaction(TransactionDefinition definition) {
            return new SimpleTransactionStatus();
        }

        @Override
        public void commit(TransactionStatus status) {
        }

        @Override
        public void rollback(TransactionStatus status) {
        }
    }
}
