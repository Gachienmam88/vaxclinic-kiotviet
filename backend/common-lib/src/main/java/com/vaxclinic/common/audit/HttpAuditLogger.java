package com.vaxclinic.common.audit;

import com.vaxclinic.common.security.ServiceTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.LinkedBlockingDeque;
import java.util.concurrent.TimeUnit;

/**
 * Gửi lịch sử thao tác sang identity-service /internal/audit-logs theo lô, trên 1 luồng nền (không chặn nghiệp vụ).
 * identity-service tạm lỗi → giữ trong hàng đợi và gửi lại; hàng đợi đầy (10.000) → bỏ bản ghi cũ nhất.
 * Giới hạn đã biết: tắt service khi hàng đợi chưa gửi hết thì mất các bản ghi đó.
 */
public class HttpAuditLogger implements AuditLogger {

    private static final Logger log = LoggerFactory.getLogger(HttpAuditLogger.class);
    private static final int CAPACITY = 10_000;

    private final RestClient http;
    private final ServiceTokenProvider tokens;
    private final LinkedBlockingDeque<AuditEvent> queue = new LinkedBlockingDeque<>();

    public HttpAuditLogger(String identityUrl, ServiceTokenProvider tokens) {
        this.http = RestClient.builder().baseUrl(identityUrl).build();
        this.tokens = tokens;
        Thread t = new Thread(this::loop, "audit-sender");
        t.setDaemon(true);
        t.start();
    }

    @Override
    public void record(AuditEvent event) {
        while (queue.size() >= CAPACITY) {
            queue.pollFirst();
        }
        queue.offerLast(event);
    }

    private void loop() {
        while (!Thread.currentThread().isInterrupted()) {
            List<AuditEvent> batch = new ArrayList<>();
            try {
                AuditEvent first = queue.pollFirst(2, TimeUnit.SECONDS);
                if (first == null) {
                    continue;
                }
                batch.add(first);
                queue.drainTo(batch, 199);
                http.post().uri("/internal/audit-logs").header("Authorization", "Bearer " + tokens.token())
                        .body(batch).retrieve().toBodilessEntity();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (RuntimeException e) {
                log.warn("Cannot send {} audit events, will retry: {}", batch.size(), e.getMessage());
                for (int i = batch.size() - 1; i >= 0; i--) {
                    queue.offerFirst(batch.get(i));
                }
                try {
                    Thread.sleep(5000);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                }
            }
        }
    }
}
