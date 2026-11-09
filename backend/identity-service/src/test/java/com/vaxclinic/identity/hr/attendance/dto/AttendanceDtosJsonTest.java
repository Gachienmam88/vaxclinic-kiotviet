package com.vaxclinic.identity.hr.attendance.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.identity.hr.attendance.dto.AttendanceDtos.ApproveResult;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** JSON của POST /api/hr/attendance/approve phải giống hệt Map.of("approved", n) trước đây. */
class AttendanceDtosJsonTest {

    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    @Test
    void approveResultMatchesPreviousMap() throws Exception {
        JsonNode now = json.valueToTree(new ApproveResult(3));
        JsonNode before = json.valueToTree(Map.of("approved", 3));
        assertThat(now).isEqualTo(before);
        assertThat(now.fieldNames()).toIterable().containsExactly("approved");
        assertThat(now.get("approved").isInt()).isTrue();
        assertThat(json.writeValueAsString(new ApproveResult(0))).isEqualTo("{\"approved\":0}");
    }
}
