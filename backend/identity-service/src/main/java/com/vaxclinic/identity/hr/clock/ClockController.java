package com.vaxclinic.identity.hr.clock;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.identity.hr.HrActor;
import com.vaxclinic.identity.hr.attendance.AttendanceQuery;
import com.vaxclinic.identity.hr.attendance.AttendanceQuery.Cell;
import com.vaxclinic.identity.hr.settings.HrSettings.Mobile;
import com.vaxclinic.identity.hr.settings.HrSettingsService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Chấm công trên điện thoại (/cham-cong). Nhân viên = tài khoản đăng nhập đã liên kết hồ sơ nhân viên.
 * Bắt buộc QR (mặc định): token lấy từ mã QR đang hiển thị tại quầy chi nhánh (đổi mỗi 60 giây), kiểm tra HMAC phía server.
 */
@RestController
public class ClockController {

    public record Me(boolean linked, UUID employeeId, String code, String name, Mobile mobile, List<Cell> cells) {
    }

    public record ClockRequest(@NotNull @Pattern(regexp = "IN|OUT") String action, @Size(max = 200) String token) {
    }

    public record ClockResult(String message, String branchName, Me me) {
    }

    public record QrToken(String token, UUID branchId, String branchName, Instant expiresAt, int refreshSeconds) {
    }

    private record Emp(UUID id, String code, String name, UUID mainBranch) {
    }

    private final JdbcTemplate jdbc;
    private final ClockTokenService tokens;
    private final PhoneClockService clock;
    private final AttendanceQuery query;
    private final HrSettingsService settings;
    private final AuditLogger audit;

    public ClockController(JdbcTemplate jdbc, ClockTokenService tokens, PhoneClockService clock, AttendanceQuery query,
                           HrSettingsService settings, AuditLogger audit) {
        this.jdbc = jdbc;
        this.tokens = tokens;
        this.clock = clock;
        this.query = query;
        this.settings = settings;
        this.audit = audit;
    }

    /** Mã QR hiển thị tại quầy (Thiết lập → Chấm công điện thoại → Hiện mã QR chi nhánh); màn hình gọi lại mỗi 60 giây. */
    @GetMapping("/api/hr/clock/qr")
    @PreAuthorize("hasAuthority('hr.manage')")
    public QrToken qr(@RequestParam UUID branchId) {
        String name = branchName(branchId);
        if (name == null) {
            throw BusinessException.notFound("BRANCH_NOT_FOUND", "Không tìm thấy chi nhánh");
        }
        Instant now = Instant.now();
        return new QrToken(tokens.issue(branchId, now), branchId, name, ClockTokenService.expiresAt(ClockTokenService.slotOf(now)),
                ClockTokenService.SLOT_SECONDS - (int) (now.getEpochSecond() % ClockTokenService.SLOT_SECONDS));
    }

    @GetMapping("/api/hr/clock/me")
    @PreAuthorize("isAuthenticated()")
    public Me me(@AuthenticationPrincipal Jwt jwt) {
        Emp e = employee(jwt);
        if (e == null) {
            return new Me(false, null, null, null, settings.mobile(), List.of());
        }
        LocalDate today = LocalDate.now(ShopSettings.ZONE);
        return new Me(true, e.id(), e.code(), e.name(), settings.mobile(), query.cells(today.minusDays(1), today, null, e.id()));
    }

    @PostMapping("/api/hr/clock")
    @PreAuthorize("isAuthenticated()")
    public ClockResult punch(@Valid @RequestBody ClockRequest req, @AuthenticationPrincipal Jwt jwt) {
        Emp e = employee(jwt);
        if (e == null) {
            throw BusinessException.badRequest("NOT_EMPLOYEE", "Tài khoản chưa được liên kết với hồ sơ nhân viên đang làm việc");
        }
        Mobile mobile = settings.mobile();
        if (!mobile.enabled()) {
            throw BusinessException.badRequest("MOBILE_DISABLED", "Cửa hàng chưa bật chấm công trên điện thoại");
        }
        Instant now = Instant.now();
        UUID branch = e.mainBranch();
        boolean hasToken = req.token() != null && !req.token().isBlank();
        if (hasToken || mobile.requireQr()) {
            var v = tokens.verify(req.token(), now);
            if (v == null) {
                throw BusinessException.badRequest(hasToken ? "QR_INVALID" : "QR_REQUIRED", hasToken
                        ? "Mã QR không hợp lệ hoặc đã hết hạn, hãy quét lại mã đang hiển thị tại quầy"
                        : "Hãy quét mã QR chấm công đang hiển thị tại chi nhánh");
            }
            Boolean works = jdbc.queryForObject("select exists (select 1 from hr_employee_branches where employee_id = ? and branch_id = ?)"
                    + " or exists (select 1 from hr_employees where id = ? and main_branch_id = ?)", Boolean.class, e.id(), v.branchId(), e.id(), v.branchId());
            if (!Boolean.TRUE.equals(works)) {
                throw BusinessException.badRequest("WRONG_BRANCH", "Bạn không thuộc chi nhánh " + branchName(v.branchId()));
            }
            branch = v.branchId();
        }
        var tk = settings.timekeeping();
        var r = "IN".equals(req.action()) ? clock.checkIn(e.id(), now, branch, tk) : clock.checkOut(e.id(), now, branch, tk);
        HrActor.of(jwt).audit(audit, "Chấm công", "Chấm công điện thoại " + e.name() + ": " + r.message());
        return new ClockResult(r.message(), branch == null ? null : branchName(branch), me(jwt));
    }

    private Emp employee(Jwt jwt) {
        return jdbc.query("select id, code, name, main_branch_id from hr_employees where user_id = ? and status = 'WORKING'",
                rs -> rs.next() ? new Emp(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getObject(4, UUID.class)) : null,
                UUID.fromString(jwt.getSubject()));
    }

    private String branchName(UUID id) {
        return jdbc.query("select name from branches where id = ?", rs -> rs.next() ? rs.getString(1) : null, id);
    }
}
