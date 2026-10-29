package com.vaxclinic.integration.storeprofile;

import com.vaxclinic.integration.storeprofile.EInvoicePackageAllocator.Pkg;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Gói hóa đơn (einvoice_packages), số HĐĐT đã phát hành theo ngày và tài khoản MISA. Chỉ truy cập DB. */
@Repository
public class EInvoicePackageRepository {

    /** username: tên đăng nhập MISA; hasPassword: đã lưu mật khẩu (mã hóa). */
    public record MisaAccount(String username, boolean hasPassword) {
    }

    private final JdbcTemplate jdbc;

    public EInvoicePackageRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Pkg> findAll() {
        return jdbc.query("select id, name, quantity, start_date, end_date from einvoice_packages",
                (rs, n) -> new Pkg(rs.getObject(1, UUID.class), rs.getString(2), rs.getInt(3),
                        rs.getObject(4, LocalDate.class), rs.getObject(5, LocalDate.class)));
    }

    /** Số HĐĐT đã phát hành theo ngày (giờ Việt Nam). */
    public Map<LocalDate, Long> countPublishedByDate() {
        Map<LocalDate, Long> byDate = new LinkedHashMap<>();
        jdbc.query("select (updated_at at time zone 'Asia/Ho_Chi_Minh')::date d, count(*) from einvoice_records"
                        + " where status = 'PUBLISHED' group by d",
                rs -> {
                    byDate.put(rs.getObject(1, LocalDate.class), rs.getLong(2));
                });
        return byDate;
    }

    /** null khi chưa lưu thiết lập HĐĐT. */
    public MisaAccount findMisaAccount() {
        var rows = jdbc.queryForList("select username, password_enc from einvoice_settings where id = 1");
        return rows.isEmpty() ? null : new MisaAccount((String) rows.get(0).get("username"), rows.get(0).get("password_enc") != null);
    }

    public void insert(UUID id, String name, int quantity, LocalDate startDate, LocalDate endDate) {
        jdbc.update("insert into einvoice_packages(id, name, quantity, start_date, end_date) values (?,?,?,?,?)",
                id, name, quantity, startDate, endDate);
    }

    /** Trả số dòng đã sửa (0 = không có gói). */
    public int update(UUID id, String name, int quantity, LocalDate startDate, LocalDate endDate) {
        return jdbc.update("update einvoice_packages set name = ?, quantity = ?, start_date = ?, end_date = ?, updated_at = now()"
                + " where id = ?", name, quantity, startDate, endDate, id);
    }

    public void delete(UUID id) {
        jdbc.update("delete from einvoice_packages where id = ?", id);
    }
}
