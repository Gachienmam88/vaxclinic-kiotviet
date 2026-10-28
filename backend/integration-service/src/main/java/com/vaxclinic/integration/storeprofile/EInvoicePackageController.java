package com.vaxclinic.integration.storeprofile;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.integration.storeprofile.EInvoicePackageAllocator.Pkg;
import com.vaxclinic.integration.storeprofile.EInvoicePackageAllocator.PkgUsage;
import com.vaxclinic.integration.storeprofile.EInvoicePackageAllocator.Result;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Hồ sơ cửa hàng → Hóa đơn điện tử: tài khoản MISA (từ thiết lập HĐĐT), tổng tài nguyên / đã phát hành / còn lại và
 * danh sách gói hóa đơn (nhập tay). "Còn lại" = tổng số còn lại của các gói chưa hết hạn.
 */
@RestController
@RequestMapping("/api/store-profile/einvoice")
@PreAuthorize("hasAuthority('settings.manage')")
public class EInvoicePackageController {

    public record PackageRequest(@NotBlank(message = "Nhập tên gói") @Size(max = 100) String name,
                                 @NotNull(message = "Nhập số hóa đơn") @Min(value = 1, message = "Số hóa đơn phải lớn hơn 0")
                                 @Max(10_000_000) Integer quantity,
                                 @NotNull(message = "Nhập ngày bắt đầu") LocalDate startDate,
                                 @NotNull(message = "Nhập ngày hết hạn") LocalDate endDate) {
    }

    /** account: tên đăng nhập MISA; configured: đã lưu đủ thiết lập + mật khẩu. */
    public record Summary(String account, boolean configured, String issuer, long totalQuantity, long published, long remaining,
                          long unallocated, LocalDate serviceExpiry, List<PkgUsage> packages) {
    }

    private final JdbcTemplate jdbc;

    public EInvoicePackageController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public Summary summary() {
        LocalDate today = LocalDate.now(ShopSettings.ZONE);
        List<Pkg> pkgs = jdbc.query("select id, name, quantity, start_date, end_date from einvoice_packages",
                (rs, n) -> new Pkg(rs.getObject(1, UUID.class), rs.getString(2), rs.getInt(3),
                        rs.getObject(4, LocalDate.class), rs.getObject(5, LocalDate.class)));
        Map<LocalDate, Long> byDate = new LinkedHashMap<>();
        jdbc.query("select (updated_at at time zone 'Asia/Ho_Chi_Minh')::date d, count(*) from einvoice_records"
                        + " where status = 'PUBLISHED' group by d",
                rs -> {
                    byDate.put(rs.getObject(1, LocalDate.class), rs.getLong(2));
                });
        Result r = EInvoicePackageAllocator.allocate(pkgs, byDate, today);
        var settings = jdbc.queryForList("select username, password_enc from einvoice_settings where id = 1");
        String account = settings.isEmpty() ? null : (String) settings.get(0).get("username");
        boolean configured = !settings.isEmpty() && settings.get(0).get("password_enc") != null;
        long total = r.packages().stream().mapToLong(PkgUsage::quantity).sum();
        long published = byDate.values().stream().mapToLong(Long::longValue).sum();
        long remaining = r.packages().stream().filter(p -> !"EXPIRED".equals(p.status())).mapToLong(PkgUsage::remaining).sum();
        LocalDate expiry = pkgs.stream().map(Pkg::endDate).max(LocalDate::compareTo).orElse(null);
        return new Summary(account, configured, "MISA meInvoice", total, published, remaining, r.unallocated(), expiry, r.packages());
    }

    @PostMapping("/packages")
    public Summary create(@Valid @RequestBody PackageRequest r) {
        validate(r);
        jdbc.update("insert into einvoice_packages(id, name, quantity, start_date, end_date) values (?,?,?,?,?)",
                UUID.randomUUID(), r.name().trim(), r.quantity(), r.startDate(), r.endDate());
        return summary();
    }

    @PutMapping("/packages/{id}")
    public Summary update(@PathVariable UUID id, @Valid @RequestBody PackageRequest r) {
        validate(r);
        int n = jdbc.update("update einvoice_packages set name = ?, quantity = ?, start_date = ?, end_date = ?, updated_at = now()"
                + " where id = ?", r.name().trim(), r.quantity(), r.startDate(), r.endDate(), id);
        if (n == 0) {
            throw BusinessException.notFound("PACKAGE_NOT_FOUND", "Không tìm thấy gói hóa đơn");
        }
        return summary();
    }

    @DeleteMapping("/packages/{id}")
    public Summary delete(@PathVariable UUID id) {
        jdbc.update("delete from einvoice_packages where id = ?", id);
        return summary();
    }

    private static void validate(PackageRequest r) {
        if (r.endDate().isBefore(r.startDate())) {
            throw BusinessException.badRequest("INVALID_PACKAGE_DATES", "Ngày hết hạn phải từ ngày bắt đầu trở đi");
        }
    }
}
