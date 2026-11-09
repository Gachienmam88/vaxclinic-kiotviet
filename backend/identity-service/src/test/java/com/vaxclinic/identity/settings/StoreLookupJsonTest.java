package com.vaxclinic.identity.settings;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.identity.settings.StoreAccessController.StoreLookup;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** JSON của GET /api/auth/store phải giống hệt Map.of("code", ..., "name", ..., "logo", ...) trước đây. */
class StoreLookupJsonTest {

    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    @Test
    void lookupMatchesPreviousMap() {
        JsonNode now = json.valueToTree(new StoreLookup("vacxinso1", "Vắc xin số 1", ""));
        JsonNode before = json.valueToTree(Map.of("code", "vacxinso1", "name", "Vắc xin số 1", "logo", ""));
        assertThat(now).isEqualTo(before);
        assertThat(now.fieldNames()).toIterable().containsExactlyInAnyOrder("code", "name", "logo");
    }
}
