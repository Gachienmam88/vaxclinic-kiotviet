package com.vaxclinic.integration.einvoice;

import com.vaxclinic.common.http.InternalRestClientFactory;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vaxclinic.common.error.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

/**
 * MISA meInvoice API (doc.meinvoice.vn): lấy token (appid + MST + tài khoản) → phát hành hóa đơn máy tính tiền.
 * Đường dẫn token / phát hành cấu hình được (app.misa.*) vì tài liệu MISA có vài phiên bản đường dẫn khác nhau.
 */
@Component
public class MisaClient {

    public record Account(String environment, String appId, String taxCode, String username, String password) {
    }

    public record PublishResult(boolean ok, String transactionId, String invSeries, String invNo, String invCode,
                                String invDate, String error) {
    }

    private final String testUrl;
    private final String prodUrl;
    private final String tokenPath;
    private final String publishPath;
    private final ObjectMapper json;
    private String cachedToken;
    private String cachedFor;
    private Instant cachedUntil = Instant.EPOCH;

    private final InternalRestClientFactory httpFactory;
    private final Duration externalReadTimeout;

    public MisaClient(@Value("${app.misa.test-url}") String testUrl, @Value("${app.misa.prod-url}") String prodUrl,
                      @Value("${app.misa.token-path}") String tokenPath, @Value("${app.misa.publish-path}") String publishPath,
                      ObjectMapper json, InternalRestClientFactory httpFactory,
                      @Value("${app.http.external-read-timeout:30s}") Duration externalReadTimeout) {
        this.httpFactory = httpFactory;
        this.externalReadTimeout = externalReadTimeout;
        this.testUrl = testUrl;
        this.prodUrl = prodUrl;
        this.tokenPath = tokenPath;
        this.publishPath = publishPath;
        this.json = json;
    }

    private RestClient http(Account a) {
        return httpFactory.create("PROD".equals(a.environment()) ? prodUrl : testUrl, externalReadTimeout);
    }

    /** Token MISA sống ~24h; cache 20h theo (môi trường, MST, tài khoản). */
    public synchronized String token(Account a) {
        String key = a.environment() + "|" + a.taxCode() + "|" + a.username();
        if (key.equals(cachedFor) && Instant.now().isBefore(cachedUntil)) {
            return cachedToken;
        }
        JsonNode r = call(() -> http(a).post().uri(tokenPath).body(Map.of("appid", a.appId(), "taxcode", a.taxCode(),
                "username", a.username(), "password", a.password())).retrieve().body(JsonNode.class));
        if (!r.path("Success").asBoolean(false) || r.path("Data").asText("").isEmpty()) {
            throw BusinessException.badRequest("MISA_AUTH_FAILED", "MISA từ chối đăng nhập: " + describe(r.path("ErrorCode").asText("")));
        }
        cachedToken = r.path("Data").asText();
        cachedFor = key;
        cachedUntil = Instant.now().plus(20, ChronoUnit.HOURS);
        return cachedToken;
    }

    public PublishResult publish(Account a, Map<String, Object> item) {
        String token = token(a);
        JsonNode r = call(() -> http(a).post().uri(publishPath).header("Authorization", "Bearer " + token)
                .header("CompanyTaxCode", a.taxCode()).body(List.of(item)).retrieve().body(JsonNode.class));
        // Success=true chỉ nghĩa là MISA nhận request; phải xem ErrorCode của TỪNG hóa đơn trong Data.
        if (!r.path("Success").asBoolean(false)) {
            return new PublishResult(false, null, null, null, null, null, describe(r.path("ErrorCode").asText("")) + " " + r.path("Errors"));
        }
        JsonNode data = r.path("Data");
        try {
            JsonNode list = data.isTextual() ? json.readTree(data.asText()) : data;
            JsonNode first = list.isArray() && !list.isEmpty() ? list.get(0) : list;
            String err = first.path("ErrorCode").asText("");
            if (!err.isEmpty()) {
                return new PublishResult(false, null, null, null, null, null, describe(err));
            }
            return new PublishResult(true, first.path("TransactionID").asText(null), first.path("InvSeries").asText(null),
                    first.path("InvNo").asText(null), first.path("InvCode").asText(null), first.path("InvDate").asText(null), null);
        } catch (java.io.IOException e) {
            return new PublishResult(false, null, null, null, null, null, "Không đọc được phản hồi MISA: " + data);
        }
    }

    private static String describe(String code) {
        return switch (code) {
            case "InvalidAppID" -> "AppID không đúng (InvalidAppID)";
            case "InactiveAppID" -> "AppID đã bị khóa (InactiveAppID)";
            case "UnAuthorize" -> "Sai tài khoản / mật khẩu meInvoice (UnAuthorize)";
            case "InvoiceDuplicated" -> "Hóa đơn đã được phát hành trước đó (InvoiceDuplicated)";
            case "InvoiceNumberNotCotinuous" -> "Số hóa đơn không liên tục (InvoiceNumberNotCotinuous)";
            default -> code.isEmpty() ? "lỗi không rõ" : code;
        };
    }

    private static JsonNode call(java.util.function.Supplier<JsonNode> fn) {
        try {
            JsonNode n = fn.get();
            if (n == null) {
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "MISA_EMPTY", "MISA không trả dữ liệu");
            }
            return n;
        } catch (RestClientResponseException e) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "MISA_HTTP_" + e.getStatusCode().value(),
                    "MISA báo lỗi " + e.getStatusCode().value() + ": " + e.getResponseBodyAsString());
        } catch (ResourceAccessException e) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "MISA_UNREACHABLE", "Không kết nối được MISA meInvoice");
        }
    }
}
