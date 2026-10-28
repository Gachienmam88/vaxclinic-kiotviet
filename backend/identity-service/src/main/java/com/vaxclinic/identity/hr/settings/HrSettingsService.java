package com.vaxclinic.identity.hr.settings;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.identity.hr.settings.HrSettings.BranchWorkdays;
import com.vaxclinic.identity.hr.settings.HrSettings.Holiday;
import com.vaxclinic.identity.hr.settings.HrSettings.Mobile;
import com.vaxclinic.identity.hr.settings.HrSettings.Payroll;
import com.vaxclinic.identity.hr.settings.HrSettings.Template;
import com.vaxclinic.identity.hr.settings.HrSettings.Timekeeping;
import com.vaxclinic.identity.settings.SettingsStore;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Đọc thiết lập HR (khóa chưa lưu → giá trị mặc định như KiotViet) và các phép tra cứu dùng chung (ngày lễ, ngày làm việc). */
@Service
public class HrSettingsService {

    public static final List<Integer> ALL_DAYS = List.of(1, 2, 3, 4, 5, 6, 7);

    private final SettingsStore store;
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public HrSettingsService(SettingsStore store, JdbcTemplate jdbc, ObjectMapper json) {
        this.store = store;
        this.jdbc = jdbc;
        this.json = json;
    }

    public Timekeeping timekeeping() {
        Timekeeping t = store.read("hr.timekeeping", Timekeeping.class);
        return t == null ? Timekeeping.defaults() : t;
    }

    public Payroll payroll() {
        Payroll p = store.read("hr.payroll", Payroll.class);
        return p == null ? Payroll.defaults() : p;
    }

    public Mobile mobile() {
        Mobile m = store.read("hr.mobile", Mobile.class);
        return m == null ? Mobile.defaults() : m;
    }

    public List<BranchWorkdays> workdays() {
        return readList("hr.workdays", new TypeReference<>() { });
    }

    public List<Holiday> holidays() {
        return readList("hr.holidays", new TypeReference<>() { });
    }

    public List<Template> templates() {
        return readList("hr.templates", new TypeReference<>() { });
    }

    public void write(String key, Object value, UUID userId) {
        store.write(key, value, userId);
    }

    /** Ngày làm việc trong tuần của chi nhánh; chưa thiết lập → cả 7 ngày (mặc định KiotViet "T2 … CN"). */
    public List<Integer> workdaysOf(UUID branchId) {
        return workdays().stream().filter(w -> w.branchId().equals(branchId)).findFirst()
                .map(BranchWorkdays::days).orElse(ALL_DAYS);
    }

    /** Hệ số lương ngày lễ (%, VD 200) của ngày; không phải ngày lễ → null. */
    public BigDecimal holidayMultiplier(List<Holiday> holidays, LocalDate date) {
        return holidays.stream().filter(h -> !date.isBefore(h.from()) && !date.isAfter(h.to()))
                .map(Holiday::multiplier).max(BigDecimal::compareTo).orElse(null);
    }

    private <T> List<T> readList(String key, TypeReference<List<T>> type) {
        return jdbc.query("select value::text from app_settings where key = ?", rs -> {
            if (!rs.next()) {
                return List.<T>of();
            }
            try {
                return json.readValue(rs.getString(1), type);
            } catch (JsonProcessingException e) {
                throw new IllegalStateException("Invalid setting " + key, e);
            }
        }, key);
    }
}
