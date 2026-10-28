package com.vaxclinic.identity.storeprofile;

import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.identity.settings.SettingsStore;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.SessionCutoff;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.StorePause;
import com.vaxclinic.identity.storeprofile.StoreProfileModels.StoreStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * Trạng thái gian hàng: đang bảo lưu hay không + mốc vô hiệu phiên. Tính theo ngày hiện tại nên tự mở lại đúng ngày
 * reopenOn mà không cần job. API công khai /api/auth/store-status: gateway đọc định kỳ để chặn API (423) khi bảo lưu
 * và từ chối JWT cũ sau khi đổi tên gian hàng; màn hình đọc để hiện thông báo bảo lưu. Không lộ dữ liệu nào khác.
 */
@RestController
public class StoreStatusService {

    static final String PAUSE_KEY = "store_pause";
    static final String CUTOFF_KEY = "session_cutoff";

    private final SettingsStore store;

    public StoreStatusService(SettingsStore store) {
        this.store = store;
    }

    @GetMapping("/api/auth/store-status")
    public StoreStatus status() {
        StorePause p = store.read(PAUSE_KEY, StorePause.class);
        SessionCutoff c = store.read(CUTOFF_KEY, SessionCutoff.class);
        boolean paused = isPaused(p, LocalDate.now(ShopSettings.ZONE));
        return new StoreStatus(paused, paused ? p.reopenOn() : null, p != null, c == null ? 0 : c.notBefore());
    }

    static boolean isPaused(StorePause p, LocalDate today) {
        return p != null && p.reopenedAt() == null && p.reopenOn() != null && today.isBefore(p.reopenOn());
    }
}
