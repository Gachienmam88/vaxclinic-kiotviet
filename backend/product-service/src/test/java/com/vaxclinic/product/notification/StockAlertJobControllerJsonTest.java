package com.vaxclinic.product.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** POST /internal/notification-jobs/run: record thay Map.of("alerts", n) phải cho cùng JSON. */
class StockAlertJobControllerJsonTest {

    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    @Test
    void runResultSerializesLikePreviousMap() throws Exception {
        String now = json.writeValueAsString(new StockAlertJobController.RunResult(7));
        String before = json.writeValueAsString(Map.of("alerts", 7));
        assertThat(now).isEqualTo("{\"alerts\":7}").isEqualTo(before);
        assertThat(json.readTree(now)).isEqualTo(json.readTree(before));
    }
}
