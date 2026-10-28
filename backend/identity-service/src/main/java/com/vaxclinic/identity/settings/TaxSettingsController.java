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

    /** Ngành nghề kinh doanh do cửa hàng tự khai: tỷ lệ % GTGT và TNCN trên doanh thu của ngành. */
    public record Sector(@NotBlank @Size(max = 30) String code, @NotBlank @Size(max = 200) String name,
                         @NotNull @DecimalMin("0") @DecimalMax("20") BigDecimal vatRate,
                         @NotNull @DecimalMin("0") @DecimalMax("20") BigDecimal pitRate) {
    }

    /**
     * sectors: danh sách ngành nghề; defaultSector: ngành của hàng thuộc nhóm chưa gắn ngành;
     * categorySectors: id nhóm hàng → mã ngành (nhóm con chưa gắn thì theo nhóm cha);
     * defaultTaxCode: thuế suất cho dòng hàng chưa có mã thuế (quyết định có chịu GTGT hay không).
     */
    public record TaxSettings(boolean vatEnabled, @Valid List<Sector> sectors, String defaultSector,
                              Map<UUID, String> categorySectors, @Size(max = 30) String defaultTaxCode,
                              @Valid List<TaxProfile> profiles) {
    }

    /** 5 nhóm ngành theo quy định thuế hộ kinh doanh 2026 (tỷ lệ % trên doanh thu) — sửa / thêm được. */
    static final List<Sector> DEFAULT_SECTORS = List.of(
            new Sector("PHAN_PHOI", "Phân phối, cung cấp hàng hóa", new BigDecimal("1"), new BigDecimal("0.5")),
            new Sector("SAN_XUAT", "Sản xuất, vận tải, dịch vụ có gắn với hàng hóa", new BigDecimal("3"), new BigDecimal("1.5")),
            new Sector("DICH_VU", "Dịch vụ, xây dựng không bao thầu nguyên vật liệu", new BigDecimal("5"), new BigDecimal("2")),
            new Sector("CHO_THUE", "Cho thuê tài sản, đại lý, nội dung số", new BigDecimal("5"), new BigDecimal("5")),
            new Sector("KHAC", "Hoạt động kinh doanh khác", new BigDecimal("2"), new BigDecimal("1")));

    static final TaxSettings DEFAULT = new TaxSettings(true, DEFAULT_SECTORS, "SAN_XUAT", Map.of(), "HKD_KCT_15", List.of());

    private final SettingsStore store;
    private final AuditLogger audit;

    public TaxSettingsController(SettingsStore store, AuditLogger audit) {
        this.store = store;
        this.audit = audit;
    }

    @GetMapping("/api/settings/tax")
    public TaxSettings get() {
        TaxSettings t = store.read("tax", TaxSettings.class);
        if (t == null) {
            return DEFAULT;
        }
        // Bản lưu cũ (1 ngành chung) chưa có danh sách ngành → dùng danh sách mặc định
        return t.sectors() == null || t.sectors().isEmpty()
                ? new TaxSettings(t.vatEnabled(), DEFAULT_SECTORS, DEFAULT.defaultSector(), Map.of(), t.defaultTaxCode(), t.profiles())
                : t;
    }

    @PutMapping("/api/settings/tax")
    @PreAuthorize("hasAuthority('settings.manage')")
    public TaxSettings save(@Valid @RequestBody TaxSettings req, @AuthenticationPrincipal Jwt jwt) {
        List<TaxProfile> profiles = req.profiles() == null ? List.of() : req.profiles();
        List<Sector> sectors = req.sectors() == null ? List.of() : req.sectors();
        if (sectors.isEmpty()) {
            throw BusinessException.badRequest("SECTOR_REQUIRED", "Cần ít nhất 1 ngành nghề");
        }
        var sectorCodes = new HashSet<String>();
        for (Sector s : sectors) {
            if (!sectorCodes.add(s.code())) {
                throw BusinessException.badRequest("SECTOR_DUPLICATED", "Mã ngành nghề " + s.code() + " bị trùng");
            }
        }
        if (!sectorCodes.contains(req.defaultSector())) {
            throw BusinessException.badRequest("SECTOR_NOT_FOUND", "Ngành nghề mặc định không có trong danh sách");
        }
        Map<UUID, String> categorySectors = req.categorySectors() == null ? Map.of() : req.categorySectors();
        if (!sectorCodes.containsAll(categorySectors.values())) {
            throw BusinessException.badRequest("SECTOR_NOT_FOUND", "Nhóm hàng đang gắn với ngành nghề đã bị xóa");
        }
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
        var saved = new TaxSettings(req.vatEnabled(), sectors, req.defaultSector(), categorySectors, req.defaultTaxCode(), profiles);
        store.write("tax", saved, UUID.fromString(jwt.getSubject()));
        audit.record(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"), null, "Thuế & Kế toán", "Sửa", null,
                "Thiết lập thuế: " + sectors.stream().map(s -> s.name() + " (GTGT " + s.vatRate() + "%, TNCN " + s.pitRate() + "%)").toList()
                        + ", " + categorySectors.size() + " nhóm hàng gắn ngành, " + profiles.size() + " mã số thuế");
        return saved;
    }
}
