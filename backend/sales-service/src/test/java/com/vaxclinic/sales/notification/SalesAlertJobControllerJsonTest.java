package com.vaxclinic.sales.notification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class SalesAlertJobControllerJsonTest {

    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    private JsonNode tree(Object o) {
        return json.valueToTree(o);
    }

    @Test
    void runResultMatchesPreviousMap() throws Exception {
        assertThat(json.writeValueAsString(new SalesAlertJobController.RunResult(5))).isEqualTo("{\"alerts\":5}");
        assertThat(tree(new SalesAlertJobController.RunResult(0))).isEqualTo(tree(Map.of("alerts", 0)));
    }
}
