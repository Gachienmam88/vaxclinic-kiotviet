package com.vaxclinic.identity.settings;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.settings.SettingsController.StoreInfo;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.text.Normalizer;
import java.util.Map;

/**
 * Bước 1 của đăng nhập: "Địa chỉ truy cập cửa hàng". Hệ thống dùng nội bộ cho 1 doanh nghiệp nên chỉ có 1 địa chỉ;
 * nhập đúng → trả tên + logo để màn đăng nhập hiển thị. API công khai (chưa đăng nhập), không lộ thông tin nào khác.
 */
@RestController
public class StoreAccessController {

    static final String FALLBACK_CODE = "vaxclinic";

    private final SettingsRepository store;

    public StoreAccessController(SettingsRepository store) {
        this.store = store;
    }

    /** Địa chỉ đang dùng: đã đặt trong Thiết lập → Thông tin cửa hàng, hoặc tự sinh từ tên (VD "Vắc xin số 1" → "vacxinso1"). */
    public static String accessCodeOf(StoreInfo info) {
        if (info == null) {
            return FALLBACK_CODE;
        }
        if (info.accessCode() != null && !info.accessCode().isBlank()) {
            return info.accessCode();
        }
        String slug = Normalizer.normalize(info.name(), Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .replace('đ', 'd').replace('Đ', 'D').toLowerCase().replaceAll("[^a-z0-9]", "");
        return slug.length() >= 3 ? slug.substring(0, Math.min(40, slug.length())) : FALLBACK_CODE;
    }

    @GetMapping("/api/auth/store")
    public Map<String, Object> lookup(@RequestParam String code) {
        StoreInfo info = store.read("store", StoreInfo.class);
        String expected = accessCodeOf(info);
        if (!expected.equalsIgnoreCase(code.trim())) {
            throw BusinessException.notFound("STORE_NOT_FOUND", "Không tìm thấy cửa hàng. Kiểm tra lại địa chỉ truy cập");
        }
        return Map.of("code", expected, "name", info == null ? "VaxClinic" : info.name(),
                "logo", info == null || info.logo() == null ? "" : info.logo());
    }
}
