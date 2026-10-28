package com.vaxclinic.identity.storeprofile;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.web.PageResponse;
import com.vaxclinic.identity.auth.twofactor.TwoFactorService;
import com.vaxclinic.identity.branch.BranchRepository;
import com.vaxclinic.identity.settings.SettingsController.StoreInfo;
import com.vaxclinic.identity.settings.SettingsStore;
import com.vaxclinic.identity.settings.StoreAccessController;
import com.vaxclinic.identity.storeprofile.StoreProfileHistoryRepository.HistoryItem;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.OwnerProfile;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.PhoneRequest;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.ProfileRequest;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.ProfileView;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.UserRef;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.VerifyRequest;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.VerifyResponse;
import com.vaxclinic.identity.user.AppUser;
import com.vaxclinic.identity.user.AppUserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Thông tin hồ sơ (chủ gian hàng) + thông tin gian hàng. Email / điện thoại / địa chỉ ghi vào "store" (cùng nguồn với
 * Thiết lập → Thông tin cửa hàng và đầu mẫu in), phần còn lại ở "owner_profile". Mỗi lần cập nhật ghi Lịch sử thao tác
 * tính năng {@value #FEATURE} (tab "Lịch sử cập nhật"). Mỗi hàm public = 1 thao tác trọn vẹn: kiểm tra quyền
 * ({@link StoreProfileAccess}) → kiểm tra phiếu xác thực ({@link StoreActionVerifier}) → ghi → trả màn hình mới.
 */
@Service
public class StoreProfileService {

    public static final String FEATURE = "Hồ sơ cửa hàng";
    static final String PROFILE_KEY = "owner_profile";
    static final String INDUSTRY = "Tiêm chủng";
    private static final Set<String> OWNER_PURPOSES = Set.of("RENAME", "TRANSFER", "PAUSE");

    private final SettingsStore store;
    private final StoreStatusService status;
    private final StoreProfileAccess access;
    private final StoreActionVerifier verifier;
    private final AppUserRepository users;
    private final BranchRepository branches;
    private final StoreProfileHistoryRepository history;
    private final TwoFactorService twoFactor;
    private final AuditLogger audit;

    public StoreProfileService(SettingsStore store, StoreStatusService status, StoreProfileAccess access, StoreActionVerifier verifier,
                               AppUserRepository users, BranchRepository branches, StoreProfileHistoryRepository history,
                               TwoFactorService twoFactor, AuditLogger audit) {
        this.store = store;
        this.status = status;
        this.access = access;
        this.verifier = verifier;
        this.users = users;
        this.branches = branches;
        this.history = history;
        this.twoFactor = twoFactor;
        this.audit = audit;
    }

    public ProfileView view(UUID userId, List<String> permissions) {
        return view(access.requireManager(userId, permissions));
    }

    /** Bước "Xác thực": đổi tên / chuyển nhượng / bảo lưu chỉ chủ gian hàng; hồ sơ / số điện thoại thêm quyền settings.manage. */
    public VerifyResponse verify(UUID userId, List<String> permissions, VerifyRequest r) {
        AppUser u = OWNER_PURPOSES.contains(r.purpose()) ? access.requireOwner(userId) : access.requireManager(userId, permissions);
        return verifier.issue(u, r.purpose(), r.password(), r.code());
    }

    @Transactional
    public ProfileView updateProfile(UUID userId, List<String> permissions, ProfileRequest r) {
        AppUser actor = access.requireManager(userId, permissions);
        verifier.check(actor.getId(), "PROFILE", r.verifyToken());
        StoreInfo s = storeInfo();
        store.write(PROFILE_KEY, new OwnerProfile(r.businessType(), r.birthDate(), r.representative().trim(), r.idNumber().trim(),
                r.idIssueDate(), blankToNull(r.idIssuePlace()), r.gender()), actor.getId());
        store.write("store", new StoreInfo(s.name(), s.phone(), r.email().trim(), r.address().trim(), blankToNull(r.province()),
                blankToNull(r.ward()), s.taxCode(), s.logo(), currentAccessCode(), blankToNull(r.provinceCode()),
                blankToNull(r.wardCode())), actor.getId());
        log(actor, "Cập nhật thông tin hồ sơ: người đại diện " + r.representative().trim() + ", email " + r.email().trim()
                + ", địa chỉ " + r.address().trim());
        return view(actor);
    }

    @Transactional
    public ProfileView updatePhone(UUID userId, List<String> permissions, PhoneRequest r) {
        AppUser actor = access.requireManager(userId, permissions);
        verifier.check(actor.getId(), "PHONE", r.verifyToken());
        StoreInfo s = storeInfo();
        store.write("store", new StoreInfo(s.name(), r.phone(), s.email(), s.address(), s.province(), s.ward(), s.taxCode(),
                s.logo(), currentAccessCode(), s.provinceCode(), s.wardCode()), actor.getId());
        log(actor, "Cập nhật số điện thoại chủ gian hàng: " + (s.phone() == null ? "(trống)" : s.phone()) + " → " + r.phone());
        return view(actor);
    }

    public PageResponse<HistoryItem> history(UUID userId, List<String> permissions, int page, int size) {
        access.requireManager(userId, permissions);
        int limit = Math.min(Math.max(size, 1), 100);
        int p = Math.max(page, 0);
        return new PageResponse<>(history.findByFeature(FEATURE, limit, (long) p * limit), history.countByFeature(FEATURE), p, limit);
    }

    ProfileView view(AppUser viewer) {
        OwnerProfile p = Objects.requireNonNullElse(store.read(PROFILE_KEY, OwnerProfile.class),
                new OwnerProfile(null, null, null, null, null, null, null));
        StoreInfo s = storeInfo();
        UserRef owner = users.findFirstByOwnerTrue().map(u -> new UserRef(u.getId(), u.getUsername(), u.getFullName())).orElse(null);
        return new ProfileView(p.businessType(), p.birthDate(), p.representative(), p.idNumber(), p.idIssueDate(), p.idIssuePlace(),
                p.gender(), s.email(), s.phone(), s.address(), s.province(), s.ward(), s.provinceCode(), s.wardCode(), s.name(),
                currentAccessCode(), INDUSTRY, branches.countByActiveTrue(), status.status(), owner, viewer.isOwner(),
                twoFactor.enabled(viewer.getId()));
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

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
