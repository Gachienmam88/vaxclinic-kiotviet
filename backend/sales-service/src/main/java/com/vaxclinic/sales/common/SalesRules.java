package com.vaxclinic.sales.common;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.common.settings.ShopSettingsClient;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/** Áp dụng các thiết lập cửa hàng (Thiết lập → Đơn hàng / Khóa sổ) cho chứng từ bán hàng. */
@Component
public class SalesRules {

    private final ShopSettingsClient settings;
    private final EInvoicePublishedClient einvoices;

    public SalesRules(ShopSettingsClient settings, EInvoicePublishedClient einvoices) {
        this.settings = settings;
        this.einvoices = einvoices;
    }

    public ShopSettings settings() {
        return settings.get();
    }

    public void checkNotLocked(UUID branchId, Instant documentTime) {
        settings().checkNotLocked(branchId, documentTime);
    }

    /** Thiết lập "Chặn chỉnh sửa/hủy hóa đơn đã phát hành HĐĐT". Không hỏi được integration-service → chặn (an toàn). */
    public void checkEInvoiceNotPublished(UUID invoiceId, String action) {
        if (!settings().sales().blockEditPublishedEInvoice()) {
            return;
        }
        if (einvoices.isPublished(invoiceId)) {
            throw BusinessException.badRequest("EINVOICE_PUBLISHED",
                    "Hóa đơn đã phát hành hóa đơn điện tử, không được " + action + " (Thiết lập → Đơn hàng)");
        }
    }

    /** Thiết lập "Giới hạn thời gian trả hàng": chỉ nhận trả trong N ngày kể từ ngày bán. */
    public void checkReturnWindow(Instant soldAt, Instant returnedAt) {
        Integer days = settings().sales().returnLimitDays();
        if (days != null && returnedAt.isAfter(soldAt.plus(Duration.ofDays(days)))) {
            throw BusinessException.badRequest("RETURN_WINDOW_EXPIRED",
                    "Hóa đơn đã quá " + days + " ngày kể từ ngày bán, không nhận trả hàng");
        }
    }
}
