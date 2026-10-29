package com.vaxclinic.identity.settings;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.common.settings.ShopSettings;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/** Đọc / ghi bảng app_settings (khóa → JSON). Khóa chưa có dòng → null (dùng mặc định). Chỉ truy cập DB. */
@Repository
public class SettingsRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public SettingsRepository(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public <T> T read(String key, Class<T> type) {
        return jdbc.query("select value::text from app_settings where key = ?", rs -> {
            if (!rs.next()) {
                return null;
            }
            try {
                return json.readValue(rs.getString(1), type);
            } catch (JsonProcessingException e) {
                throw new IllegalStateException("Invalid setting " + key, e);
            }
        }, key);
    }

    /** Như {@link #read(String, Class)} cho kiểu generic (VD danh sách). */
    public <T> T read(String key, TypeReference<T> type) {
        return jdbc.query("select value::text from app_settings where key = ?", rs -> {
            if (!rs.next()) {
                return null;
            }
            try {
                return json.readValue(rs.getString(1), type);
            } catch (JsonProcessingException e) {
                throw new IllegalStateException("Invalid setting " + key, e);
            }
        }, key);
    }

    public void write(String key, Object value, UUID userId) {
        try {
            jdbc.update("""
                    insert into app_settings(key, value, updated_by, updated_at) values (?, ?::jsonb, ?, now())
                    on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()
                    """, key, json.writeValueAsString(value), userId);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Xóa khóa (lần đọc sau trả null → dùng mặc định). */
    public void delete(String key) {
        jdbc.update("delete from app_settings where key = ?", key);
    }

    public ShopSettings shop() {
        return new ShopSettings(read("sales", ShopSettings.Sales.class),
                read("customer", ShopSettings.CustomerRules.class), read("lock", ShopSettings.BookLock.class));
    }
}
