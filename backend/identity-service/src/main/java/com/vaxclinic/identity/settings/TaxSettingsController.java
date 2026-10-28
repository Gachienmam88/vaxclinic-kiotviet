package com.vaxclinic.identity.settings;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;

/**
 * Thiết lập → Thuế & Kế toán (hộ kinh doanh, phương pháp kê khai từ 2026).
 * Ngành nghề quyết định tỷ lệ % GTGT và TNCN trên doanh thu; mỗi MST có nhóm doanh thu, cách tính TNCN và các địa điểm
 * kinh doanh gắn với chi nhánh. Sổ kế toán / tờ khai lấy số liệu theo các chi nhánh của địa điểm đang hoạt động.
 */
@RestController
public class TaxSettingsController {

    public record Location(@NotBlank @Size(max = 10) String code, @NotBlank @Size(max = 200) String name,
                           @Size(max = 300) String address, @Size(max = 100) String province, @Size(max = 100) String ward,
                           List<UUID> branchIds, LocalDate startDate, boolean active) {
    }

    /** revenueGroup 1: ≤ 1 tỷ/năm; 2: > 1–3 tỷ; 3: > 3–50 tỷ; 4: > 50 tỷ. pitMethod: REVENUE (% doanh thu) | PROFIT (thu nhập). */
    public record TaxProfile(@NotBlank @Pattern(regexp = "\\d{10}(-?\\d{3})?|\\d{12}", message = "Mã số thuế gồm 10, 12 hoặc 13 chữ số")
                             String taxCode, @Size(max = 200) String name, @Min(1) @Max(4) int revenueGroup,
                             @NotNull @Pattern(regexp = "REVENUE|PROFIT") String pitMethod, boolean active,
                             @Valid List<Location> locations) {
    }

    /** sector: PHAN_PHOI | SAN_XUAT | DICH_VU | CHO_THUE | KHAC. defaultTaxCode: mã thuế cho dòng hàng chưa có mã. */
    public record TaxSettings(boolean vatEnabled, @NotNull @Pattern(regexp = "PHAN_PHOI|SAN_XUAT|DICH_VU|CHO_THUE|KHAC") String sector,
                              @DecimalMin("0") @DecimalMax("10") BigDecimal vatRate, @DecimalMin("0") @DecimalMax("10") BigDecimal pitRate,
                              @Size(max = 30) String defaultTaxCode, @Valid List<TaxProfile> profiles) {
    }

    static final TaxSettings DEFAULT = new TaxSettings(true, "SAN_XUAT", new BigDecimal("3"), new BigDecimal("1.5"),
            "HKD_KCT_15", List.of());

    private final SettingsStore store;
    private final AuditLogger audit;

    public TaxSettingsController(SettingsStore store, AuditLogger audit) {
        this.store = store;
        this.audit = audit;
    }

    @GetMapping("/api/settings/tax")
    public TaxSettings get() {
        TaxSettings t = store.read("tax", TaxSettings.class);
        return t == null ? DEFAULT : t;
    }

    @PutMapping("/api/settings/tax")
    @PreAuthorize("hasAuthority('settings.manage')")
    public TaxSettings save(@Valid @RequestBody TaxSettings req, @AuthenticationPrincipal Jwt jwt) {
        List<TaxProfile> profiles = req.profiles() == null ? List.of() : req.profiles();
        var taxCodes = new HashSet<String>();
        var branches = new HashSet<UUID>();
        for (TaxProfile p : profiles) {
            if (!taxCodes.add(p.taxCode())) {
                throw BusinessException.badRequest("TAX_CODE_DUPLICATED", "Mã số thuế " + p.taxCode() + " bị trùng");
            }
            var codes = new HashSet<String>();
            for (Location l : p.locations() == null ? List.<Location>of() : p.locations()) {
                if (!codes.add(l.code())) {
                    throw BusinessException.badRequest("LOCATION_CODE_DUPLICATED", "Mã địa điểm " + l.code() + " bị trùng");
                }
                // 1 chi nhánh chỉ thuộc 1 địa điểm kinh doanh đang hoạt động — tránh tính doanh thu 2 lần
                for (UUID b : l.branchIds() == null ? List.<UUID>of() : l.branchIds()) {
                    if (p.active() && l.active() && !branches.add(b)) {
                        throw BusinessException.badRequest("BRANCH_IN_TWO_LOCATIONS", "Một chi nhánh chỉ được gắn với 1 địa điểm kinh doanh");
                    }
                }
            }
        }
        var saved = new TaxSettings(req.vatEnabled(), req.sector(), req.vatRate(), req.pitRate(), req.defaultTaxCode(), profiles);
        store.write("tax", saved, UUID.fromString(jwt.getSubject()));
        audit.record(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"), null, "Thuế & Kế toán", "Sửa", null,
                "Thiết lập thuế: ngành " + req.sector() + ", GTGT " + req.vatRate() + "%, TNCN " + req.pitRate() + "%, "
                        + profiles.size() + " mã số thuế");
        return saved;
    }
}
