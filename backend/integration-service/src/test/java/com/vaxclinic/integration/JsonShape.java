package com.vaxclinic.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import org.springframework.util.LinkedCaseInsensitiveMap;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * So sánh JSON của dạng cũ (Map / dòng queryForList) với record mới. Kiểm bằng cả ObjectMapper thuần
 * (findAndRegisterModules) lẫn cấu hình mặc định của Spring Boot (ngày dạng chuỗi ISO) — module không tùy biến Jackson.
 */
public final class JsonShape {

    private static final ObjectMapper PLAIN = new ObjectMapper().findAndRegisterModules();
    private static final ObjectMapper BOOT = new ObjectMapper().findAndRegisterModules()
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    private JsonShape() {
    }

    public static void assertSameJson(Object oldShape, Object newShape) {
        for (ObjectMapper m : new ObjectMapper[]{PLAIN, BOOT}) {
            JsonNode expected = m.valueToTree(oldShape);
            JsonNode actual = m.valueToTree(newShape);
            assertEquals(expected, actual);
        }
    }

    /** Dòng giống ColumnMapRowMapper (queryForList) tạo ra: key = tên cột, giữ null. */
    public static Map<String, Object> row(Object... keyValues) {
        Map<String, Object> m = new LinkedCaseInsensitiveMap<>();
        for (int i = 0; i < keyValues.length; i += 2) {
            m.put((String) keyValues[i], keyValues[i + 1]);
        }
        return m;
    }
}
