package com.vaxclinic.identity.hr.schedule;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.identity.hr.schedule.ScheduleDtos.CreateResult;
import com.vaxclinic.identity.hr.schedule.ScheduleDtos.ImportResult;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** JSON của POST /api/hr/schedules và /api/hr/schedules/import phải giống hệt Map.of(...) trước đây. */
class ScheduleDtosJsonTest {

    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    @Test
    void createResultMatchesPreviousMap() {
        JsonNode now = json.valueToTree(new CreateResult(12));
        assertThat(now).isEqualTo(json.valueToTree(Map.of("created", 12)));
        assertThat(now.fieldNames()).toIterable().containsExactly("created");
        assertThat(now.get("created").isInt()).isTrue();
    }

    @Test
    void importResultMatchesPreviousMap() {
        var errors = new ArrayList<>(List.of("Dòng 2: không tìm thấy mã nhân viên NV9", "Dòng 3: thiếu ngày"));
        JsonNode now = json.valueToTree(new ImportResult(5, errors));
        assertThat(now).isEqualTo(json.valueToTree(Map.of("created", 5, "errors", errors)));
        assertThat(now.fieldNames()).toIterable().containsExactlyInAnyOrder("created", "errors");
        assertThat(now.get("errors").isArray()).isTrue();

        JsonNode empty = json.valueToTree(new ImportResult(0, new ArrayList<>()));
        assertThat(empty).isEqualTo(json.valueToTree(Map.of("created", 0, "errors", List.of())));
    }
}
