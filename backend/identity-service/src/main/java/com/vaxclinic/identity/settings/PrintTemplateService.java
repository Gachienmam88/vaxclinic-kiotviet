package com.vaxclinic.identity.settings;

import com.vaxclinic.common.audit.AuditLogger;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.identity.settings.PrintTemplateController.TemplateRequest;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Mẫu in đã sửa, lưu trong app_settings với khóa "print:{TYPE}" (qua {@link SettingsRepository}). Loại chưa sửa → không có
 * trong kết quả, trình duyệt dùng mẫu mặc định. Mỗi lần sửa / đặt lại ghi Lịch sử thao tác tính năng "Mẫu in".
 */
@Service
public class PrintTemplateService {

    static final Set<String> TYPES = Set.of("INVOICE", "SALES_RETURN", "CASH_RECEIPT", "CASH_PAYMENT",
            "PURCHASE_RECEIPT", "PURCHASE_RETURN");
    private static final String FEATURE = "Mẫu in";

    private final SettingsRepository store;
    private final AuditLogger audit;

    public PrintTemplateService(SettingsRepository store, AuditLogger audit) {
        this.store = store;
        this.audit = audit;
    }

    /** Loại mẫu → HTML đã sửa. */
    public Map<String, String> list() {
        Map<String, String> out = new HashMap<>();
        for (String type : TYPES) {
            TemplateRequest t = store.read("print:" + type, TemplateRequest.class);
            if (t != null) {
                out.put(type, t.html());
            }
        }
        return out;
    }

    public Map<String, String> save(String type, TemplateRequest req, UUID userId, String userName) {
        store.write("print:" + checkType(type), req, userId);
        audit.record(userId, userName, null, FEATURE, "Sửa", null, "Sửa mẫu in " + type);
        return list();
    }

    /** Đặt lại về mẫu mặc định. */
    public Map<String, String> reset(String type, UUID userId, String userName) {
        store.delete("print:" + checkType(type));
        audit.record(userId, userName, null, FEATURE, "Đặt lại", null, "Đặt lại mẫu in mặc định " + type);
        return list();
    }

    private static String checkType(String type) {
        if (!TYPES.contains(type)) {
            throw BusinessException.badRequest("INVALID_TEMPLATE_TYPE", "Loại mẫu in không hợp lệ");
        }
        return type;
    }
}
