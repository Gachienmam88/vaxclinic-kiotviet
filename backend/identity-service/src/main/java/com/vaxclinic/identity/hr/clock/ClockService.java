package com.vaxclinic.identity.hr.clock;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.identity.hr.HrActor;
import com.vaxclinic.identity.hr.attendance.AttendanceQuery;
import com.vaxclinic.identity.hr.clock.ClockDtos.ClockRequest;
import com.vaxclinic.identity.hr.clock.ClockDtos.ClockResult;
import com.vaxclinic.identity.hr.clock.ClockDtos.Me;
import com.vaxclinic.identity.hr.clock.ClockDtos.QrToken;
import com.vaxclinic.identity.hr.clock.ClockRepository.Emp;
import com.vaxclinic.identity.hr.settings.HrSettings.Mobile;
import com.vaxclinic.identity.hr.settings.HrSettingsService;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Chấm công trên điện thoại (/cham-cong). Nhân viên = tài khoản đăng nhập đã liên kết hồ sơ nhân viên.
 * Bắt buộc QR (mặc định): token lấy từ mã QR đang hiển thị tại quầy chi nhánh (đổi mỗi 60 giây), kiểm tra HMAC phía server.
 */
@Service
public class ClockService {

    private final ClockRepository repo;
    private final ClockTokenService tokens;
    private final PhoneClockService clock;
    private final AttendanceQuery query;
    private final HrSettingsService settings;
    private final AuditLogger audit;

    public ClockService(ClockRepository repo, ClockTokenService tokens, PhoneClockService clock, AttendanceQuery query,
                        HrSettingsService settings, AuditLogger audit) {
        this.repo = repo;
        this.tokens = tokens;
        this.clock = clock;
        this.query = query;
        this.settings = settings;
        this.audit = audit;
    }

    /** Mã QR hiển thị tại quầy (Thiết lập → Chấm công điện thoại → Hiện mã QR chi nhánh); màn hình gọi lại mỗi 60 giây. */
    public QrToken qr(UUID branchId) {
        String name = repo.branchName(branchId);
        if (name == null) {
            throw BusinessException.notFound("BRANCH_NOT_FOUND", "Không tìm thấy chi nhánh");
        }
        Instant now = Instant.now();
        return new QrToken(tokens.issue(branchId, now), branchId, name, ClockTokenService.expiresAt(ClockTokenService.slotOf(now)),
                ClockTokenService.SLOT_SECONDS - (int) (now.getEpochSecond() % ClockTokenService.SLOT_SECONDS));
    }

    public Me me(UUID userId) {
        Emp e = repo.workingEmployeeOfUser(userId);
        if (e == null) {
            return new Me(false, null, null, null, settings.mobile(), List.of());
        }
        LocalDate today = LocalDate.now(ShopSettings.ZONE);
        return new Me(true, e.id(), e.code(), e.name(), settings.mobile(), query.cells(today.minusDays(1), today, null, e.id()));
    }

    public ClockResult punch(ClockRequest req, UUID userId, HrActor actor) {
        Emp e = repo.workingEmployeeOfUser(userId);
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
            Boolean works = repo.worksAt(e.id(), v.branchId());
            if (!Boolean.TRUE.equals(works)) {
                throw BusinessException.badRequest("WRONG_BRANCH", "Bạn không thuộc chi nhánh " + repo.branchName(v.branchId()));
            }
            branch = v.branchId();
        }
        var tk = settings.timekeeping();
        var r = "IN".equals(req.action()) ? clock.checkIn(e.id(), now, branch, tk) : clock.checkOut(e.id(), now, branch, tk);
        actor.audit(audit, "Chấm công", "Chấm công điện thoại " + e.name() + ": " + r.message());
        return new ClockResult(r.message(), branch == null ? null : repo.branchName(branch), me(userId));
    }
}
