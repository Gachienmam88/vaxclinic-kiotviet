package com.vaxclinic.identity.storeprofile.service;

import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.identity.settings.repository.SettingsStore;
import com.vaxclinic.identity.storeprofile.dto.StoreProfileModels.SessionCutoff;
import com.vaxclinic.identity.storeprofile.dto.StoreProfileModels.StorePause;
import com.vaxclinic.identity.storeprofile.dto.StoreProfileModels.StoreStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;

/**
 * Trạng thái gian hàng: đang bảo lưu hay không + mốc vô hiệu phiên. Tính theo ngày hiện tại nên tự mở lại đúng ngày
 * reopenOn mà không cần job. Dữ liệu ở app_settings (SettingsStore) khóa "store_pause" và "session_cutoff".
 */
@Service
public class StoreStatusService {

    static final String PAUSE_KEY = "store_pause";
    static final String CUTOFF_KEY = "session_cutoff";

    private final SettingsStore store;

    public StoreStatusService(SettingsStore store) {
        this.store = store;
    }

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
