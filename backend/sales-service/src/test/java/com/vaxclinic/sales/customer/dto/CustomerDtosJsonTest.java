package com.vaxclinic.sales.customer.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.sales.customer.dto.CustomerDtos.CodeResponse;
import com.vaxclinic.sales.customer.dto.CustomerDtos.GroupDeleteResponse;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Record thay Map ở CustomerController (thu nợ / chiết khấu / điều chỉnh) và CustomerGroupController (xóa nhóm). */
class CustomerDtosJsonTest {

    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    private JsonNode tree(Object o) {
        return json.valueToTree(o);
    }

    @Test
    void codeResponseMatchesPreviousMap() throws Exception {
        assertThat(json.writeValueAsString(new CodeResponse("PT000042"))).isEqualTo("{\"code\":\"PT000042\"}");
        assertThat(tree(new CodeResponse("PT000042"))).isEqualTo(tree(Map.of("code", "PT000042")));
    }

    @Test
    void groupDeleteResponseMatchesPreviousMap() throws Exception {
        assertThat(json.writeValueAsString(new GroupDeleteResponse(3))).isEqualTo("{\"unlinkedCustomers\":3}");
        assertThat(tree(new GroupDeleteResponse(0))).isEqualTo(tree(Map.of("unlinkedCustomers", 0)));
    }
}
