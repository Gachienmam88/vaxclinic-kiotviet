package com.vaxclinic.identity.hr.settings;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.identity.hr.settings.HrSettings.SetupOverview;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** JSON của GET /api/hr/settings/overview phải giống hệt Map.of(...) (giá trị long) trước đây. */
class SetupOverviewJsonTest {

    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    @Test
    void overviewMatchesPreviousMap() {
        JsonNode now = json.valueToTree(new SetupOverview(10L, 3L, 0L, 7L, 9L, 2L));
        JsonNode before = json.valueToTree(Map.of("employees", 10L, "shifts", 3L, "schedules", 0L, "timekeeping", 7L,
                "salaries", 9L, "payrolls", 2L));
        assertThat(now).isEqualTo(before);
        assertThat(now.fieldNames()).toIterable()
                .containsExactlyInAnyOrder("employees", "shifts", "schedules", "timekeeping", "salaries", "payrolls");
        now.elements().forEachRemaining(v -> assertThat(v.isIntegralNumber()).isTrue());
    }
}
