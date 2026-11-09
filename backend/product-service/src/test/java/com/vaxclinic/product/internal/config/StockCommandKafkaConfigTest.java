package com.vaxclinic.product.internal.config;

import com.vaxclinic.common.error.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.listener.ListenerExecutionFailedException;
import org.springframework.util.backoff.BackOffExecution;
import org.springframework.util.backoff.FixedBackOff;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class StockCommandKafkaConfigTest {

    @Test
    void businessRejectionGetsThreeAttemptsThenDlt() {
        var wrapped = new ListenerExecutionFailedException("listener failed",
                BusinessException.badRequest("STOCK_DOC_NOT_FOUND", "Không tìm thấy chứng từ kho gốc"));
        var backOff = assertInstanceOf(FixedBackOff.class, StockCommandKafkaConfig.backOffFor(wrapped));
        BackOffExecution exec = backOff.start();
        assertNotEquals(BackOffExecution.STOP, exec.nextBackOff()); // lần 2
        assertNotEquals(BackOffExecution.STOP, exec.nextBackOff()); // lần 3
        assertEquals(BackOffExecution.STOP, exec.nextBackOff());    // → DLT
    }

    @Test
    void infrastructureErrorKeepsDefaultUnlimitedBackOff() {
        assertNull(StockCommandKafkaConfig.backOffFor(new ListenerExecutionFailedException("listener failed",
                new IllegalStateException("db down"))));
        BackOffExecution exec = StockCommandKafkaConfig.infiniteBackOff().start();
        for (int i = 0; i < 100; i++) {
            assertNotEquals(BackOffExecution.STOP, exec.nextBackOff());
        }
    }

    @Test
    void topics() {
        var config = new StockCommandKafkaConfig();
        assertEquals("stock.commands", config.stockCommandsTopic().name());
        assertEquals(3, config.stockCommandsTopic().numPartitions());
        assertEquals("stock.commands.DLT", config.stockCommandsDltTopic().name());
        assertEquals(1, config.stockCommandsDltTopic().numPartitions());
    }
}
