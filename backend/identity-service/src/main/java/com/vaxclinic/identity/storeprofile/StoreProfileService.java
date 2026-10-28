package com.vaxclinic.identity.storeprofile;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.auth.twofactor.TwoFactorService;
import com.vaxclinic.identity.settings.SettingsController.StoreInfo;
import com.vaxclinic.identity.settings.SettingsStore;
import com.vaxclinic.identity.settings.StoreAccessController;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.OwnerProfile;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.PhoneRequest;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.ProfileRequest;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.ProfileView;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.UserRef;
import com.vaxclinic.identity.user.AppUser;
import com.vaxclinic.identity.user.AppUserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;
import java.util.UUID;

/**
 * Thông tin hồ sơ (chủ gian hàng) + thông tin gian hàng. Email / điện thoại / địa chỉ ghi vào "store" (cùng nguồn với
 * Thiết lập → Thông tin cửa hàng và đầu mẫu in), phần còn lại ở "owner_profile". Mỗi lần cập nhật ghi Lịch sử thao tác
 * tính năng {@value #FEATURE} (tab "Lịch sử cập nhật").
 */
@Service
public class StoreProfileService {

    public static final String FEATURE = "Hồ sơ cửa hàng";
    static final String PROFILE_KEY = "owner_profile";
    static final String INDUSTRY = "Tiêm chủng";

    private final SettingsStore store;
    private final StoreStatusService status;
    private final AppUserRepository users;
    private final TwoFactorService twoFactor;
    private final JdbcTemplate jdbc;
    private final AuditLogger audit;

    public StoreProfileService(SettingsStore store, StoreStatusService status, AppUserRepository users, TwoFactorService twoFactor,
                               JdbcTemplate jdbc, AuditLogger audit) {
        this.store = store;
        this.status = status;
        this.users = users;
        this.twoFactor = twoFactor;
        this.jdbc = jdbc;
        this.audit = audit;
    }

    public ProfileView view(AppUser viewer) {
        OwnerProfile p = Objects.requireNonNullElse(store.read(PROFILE_KEY, OwnerProfile.class),
                new OwnerProfile(null, null, null, null, null, null, null));
        StoreInfo s = storeInfo();
        Long branches = jdbc.queryForObject("select count(*) from branches where active", Long.class);
        UserRef owner = users.findFirstByOwnerTrue().map(u -> new UserRef(u.getId(), u.getUsername(), u.getFullName())).orElse(null);
        return new ProfileView(p.businessType(), p.birthDate(), p.representative(), p.idNumber(), p.idIssueDate(), p.idIssuePlace(),
                p.gender(), s.email(), s.phone(), s.address(), s.province(), s.ward(), s.provinceCode(), s.wardCode(), s.name(),
                StoreAccessController.accessCodeOf(store.read("store", StoreInfo.class)), INDUSTRY, branches == null ? 0 : branches,
                status.status(), owner, viewer.isOwner(), twoFactor.enabled(viewer.getId()));
    }

    @Transactional
    public void updateProfile(ProfileRequest r, AppUser actor) {
        StoreInfo s = storeInfo();
        store.write(PROFILE_KEY, new OwnerProfile(r.businessType(), r.birthDate(), r.representative().trim(), r.idNumber().trim(),
                r.idIssueDate(), blankToNull(r.idIssuePlace()), r.gender()), actor.getId());
        store.write("store", new StoreInfo(s.name(), s.phone(), r.email().trim(), r.address().trim(), blankToNull(r.province()),
                blankToNull(r.ward()), s.taxCode(), s.logo(), currentAccessCode(), blankToNull(r.provinceCode()),
                blankToNull(r.wardCode())), actor.getId());
        log(actor, "Cập nhật thông tin hồ sơ: người đại diện " + r.representative().trim() + ", email " + r.email().trim()
                + ", địa chỉ " + r.address().trim());
    }

    @Transactional
    public void updatePhone(PhoneRequest r, AppUser actor) {
        StoreInfo s = storeInfo();
        store.write("store", new StoreInfo(s.name(), r.phone(), s.email(), s.address(), s.province(), s.ward(), s.taxCode(),
                s.logo(), currentAccessCode(), s.provinceCode(), s.wardCode()), actor.getId());
        log(actor, "Cập nhật số điện thoại chủ gian hàng: " + (s.phone() == null ? "(trống)" : s.phone()) + " → " + r.phone());
    }

    /** Thông tin cửa hàng hiện tại; chưa lưu lần nào → tên mặc định để ghi được bản ghi hợp lệ. */
    StoreInfo storeInfo() {
        StoreInfo s = store.read("store", StoreInfo.class);
        return s != null ? s : new StoreInfo("VaxClinic", null, null, null, null, null, null, null, null, null, null);
    }

    /** Địa chỉ truy cập đang hiệu lực, luôn ghi tường minh để đổi tên cửa hàng không làm đổi địa chỉ đăng nhập. */
    String currentAccessCode() {
        return StoreAccessController.accessCodeOf(store.read("store", StoreInfo.class));
    }

    void log(AppUser actor, String detail) {
        audit.record(actor.getId(), actor.getFullName(), null, FEATURE, "Sửa", null, detail);
    }

    AppUser user(UUID id) {
        return users.findById(id).orElseThrow(() -> BusinessException.notFound("USER_NOT_FOUND", "Không tìm thấy người dùng"));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
