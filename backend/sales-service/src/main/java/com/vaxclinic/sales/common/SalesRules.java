package com.vaxclinic.sales.common;

import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.security.ServiceTokenProvider;
import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.common.settings.ShopSettingsClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/** Áp dụng các thiết lập cửa hàng (Thiết lập → Đơn hàng / Khóa sổ) cho chứng từ bán hàng. */
@Component
public class SalesRules {

    private final ShopSettingsClient settings;
    private final RestClient integration;
    private final ServiceTokenProvider tokens;

    public SalesRules(InternalRestClientFactory httpFactory, ShopSettingsClient settings, @Value("${app.integration-url}") String integrationUrl,
                      @Value("${app.jwt.secret}") String secret) {
        this.settings = settings;
        this.integration = httpFactory.create(integrationUrl);
        this.tokens = new ServiceTokenProvider(secret, "sales-service");
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
        Map<?, ?> res;
        try {
            res = integration.get().uri("/internal/einvoices/{id}/published", invoiceId)
                    .header("Authorization", "Bearer " + tokens.token()).retrieve().body(Map.class);
        } catch (RestClientException e) {
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "EINVOICE_SERVICE_DOWN",
                    "Không kiểm tra được trạng thái hóa đơn điện tử, vui lòng thử lại");
        }
        if (res != null && Boolean.TRUE.equals(res.get("published"))) {
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
