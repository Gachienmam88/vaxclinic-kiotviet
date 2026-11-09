package com.vaxclinic.sales.invoice.client;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.http.InternalRestClientFactory;
import org.junit.jupiter.api.Test;

import java.net.ServerSocket;
import java.net.Socket;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Dịch vụ kho "treo" (nhận kết nối nhưng không bao giờ trả lời): lời gọi phải dừng sau read-timeout và báo
 * "thử lại" (503 STOCK_SERVICE_DOWN) thay vì giữ luồng thu ngân vô hạn.
 */
class ProductStockClientTimeoutTest {

    @Test
    void hangingStockServiceTimesOutWithRetryableError() throws Exception {
        List<Socket> held = new ArrayList<>();
        try (ServerSocket server = new ServerSocket(0)) {
            Thread acceptor = new Thread(() -> {
                try {
                    while (!server.isClosed()) {
                        held.add(server.accept()); // giữ kết nối, không đọc / không trả lời
                    }
                } catch (Exception ignored) {
                    // server đóng khi test xong
                }
            });
            acceptor.setDaemon(true);
            acceptor.start();

            var client = new ProductStockClient(new InternalRestClientFactory(Duration.ofSeconds(1), Duration.ofSeconds(5)),
                    Duration.ofMillis(500), "http://127.0.0.1:" + server.getLocalPort(),
                    "test-secret-test-secret-test-secret-0123456789");
            long start = System.nanoTime();
            assertThatThrownBy(() -> client.apply(new ProductStockClient.Request(UUID.randomUUID(), "SALE", "HD1",
                    UUID.randomUUID(), "Khách lẻ", UUID.randomUUID(), null, List.of())))
                    .isInstanceOfSatisfying(BusinessException.class,
                            e -> assertThat(e.getCode()).isEqualTo("STOCK_SERVICE_DOWN"));
            assertThat(Duration.ofNanos(System.nanoTime() - start)).isLessThan(Duration.ofSeconds(4));
        } finally {
            for (Socket s : held) {
                s.close();
            }
        }
    }

    @Test
    void unreachablePortFailsFastWithRetryableError() {
        var client = new ProductStockClient(InternalRestClientFactory.defaults(), Duration.ofSeconds(10),
                "http://127.0.0.1:9", "test-secret-test-secret-test-secret-0123456789");
        assertThatThrownBy(() -> client.apply(new ProductStockClient.Request(UUID.randomUUID(), "SALE", "HD1",
                UUID.randomUUID(), "Khách lẻ", UUID.randomUUID(), null, List.of())))
                .isInstanceOfSatisfying(BusinessException.class,
                        e -> assertThat(e.getCode()).isEqualTo("STOCK_SERVICE_DOWN"));
    }
}
