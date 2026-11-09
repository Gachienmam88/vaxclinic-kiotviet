package com.vaxclinic.integration.storeprofile.repository;

import com.vaxclinic.integration.storeprofile.service.EInvoicePackageAllocator.Pkg;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** einvoice_packages (nhập tay) + số HĐĐT đã phát hành theo ngày (einvoice_records) + tài khoản MISA (einvoice_settings). */
@Repository
public class EInvoicePackageRepository {

    private final JdbcTemplate jdbc;

    public EInvoicePackageRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Pkg> findPackages() {
        return jdbc.query("select id, name, quantity, start_date, end_date from einvoice_packages",
                (rs, n) -> new Pkg(rs.getObject(1, UUID.class), rs.getString(2), rs.getInt(3),
                        rs.getObject(4, LocalDate.class), rs.getObject(5, LocalDate.class)));
    }

    /** Số HĐĐT PUBLISHED theo ngày (giờ Việt Nam) cập nhật. */
    public Map<LocalDate, Long> publishedByDate() {
        Map<LocalDate, Long> byDate = new LinkedHashMap<>();
        jdbc.query("select (updated_at at time zone 'Asia/Ho_Chi_Minh')::date d, count(*) from einvoice_records"
                        + " where status = 'PUBLISHED' group by d",
                rs -> {
                    byDate.put(rs.getObject(1, LocalDate.class), rs.getLong(2));
                });
        return byDate;
    }

    public List<Map<String, Object>> findSettingsRows() {
        return jdbc.queryForList("select username, password_enc from einvoice_settings where id = 1");
    }

    public void insert(UUID id, String name, Integer quantity, LocalDate startDate, LocalDate endDate) {
        jdbc.update("insert into einvoice_packages(id, name, quantity, start_date, end_date) values (?,?,?,?,?)",
                id, name, quantity, startDate, endDate);
    }

    /** @return số dòng cập nhật */
    public int update(UUID id, String name, Integer quantity, LocalDate startDate, LocalDate endDate) {
        return jdbc.update("update einvoice_packages set name = ?, quantity = ?, start_date = ?, end_date = ?, updated_at = now()"
                + " where id = ?", name, quantity, startDate, endDate, id);
    }

    public void delete(UUID id) {
        jdbc.update("delete from einvoice_packages where id = ?", id);
    }
}
