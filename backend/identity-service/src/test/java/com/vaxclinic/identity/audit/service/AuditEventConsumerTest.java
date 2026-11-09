package com.vaxclinic.identity.audit.service;

import com.vaxclinic.common.audit.AuditLogger.AuditEvent;
import com.vaxclinic.common.audit.AuditMessage;
import com.vaxclinic.identity.audit.repository.AuditLogRepository;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DataAccessResourceFailureException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AuditEventConsumerTest {

    /** Repository giả: ghi lại các lô; bản tin có feature null mô phỏng vi phạm NOT NULL; down = DB mất kết nối. */
    static class FakeRepo extends AuditLogRepository {
        final List<AuditMessage> stored = new ArrayList<>();
        boolean down;

        FakeRepo() {
            super(null);
        }

        @Override
        public int insertMessages(List<AuditMessage> messages) {
            if (down) {
                throw new DataAccessResourceFailureException("db down");
            }
            if (messages.stream().anyMatch(m -> m.event().feature() == null)) {
                throw new DataIntegrityViolationException("null feature");
            }
            stored.addAll(messages);
            return messages.size();
        }
    }

    private static AuditMessage msg(String feature) {
        return AuditMessage.of("sales-service", new AuditEvent(Instant.now(), null, "admin", null, feature, "Tạo", null, "x"));
    }

    @Test
    void storesBatchAndSkipsMalformedJson() {
        var repo = new FakeRepo();
        var a = msg("Hóa đơn");
        var b = msg("Khách hàng");
        new AuditEventConsumer(repo).onMessages(List.of(a.toJson(), "{not json", "{}", b.toJson()));
        assertEquals(List.of(a, b), repo.stored);
    }

    @Test
    void invalidRowIsSkippedOthersKept() {
        var repo = new FakeRepo();
        var good = msg("Hóa đơn");
        new AuditEventConsumer(repo).onMessages(List.of(good.toJson(), msg(null).toJson()));
        assertEquals(List.of(good), repo.stored);
    }

    @Test
    void databaseOutageIsRethrownForRetry() {
        var repo = new FakeRepo();
        repo.down = true;
        var consumer = new AuditEventConsumer(repo);
        assertThrows(DataAccessResourceFailureException.class, () -> consumer.onMessages(List.of(msg("Hóa đơn").toJson())));
    }
}
