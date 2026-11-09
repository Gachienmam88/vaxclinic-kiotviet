package com.vaxclinic.integration.inputinvoice.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.vaxclinic.common.http.InternalRestClientFactory;
import com.vaxclinic.common.error.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Client cổng hóa đơn điện tử của Tổng cục Thuế (hoadondientu.gdt.gov.vn).
 *
 * CẢNH BÁO: cổng KHÔNG có API công khai. Các đường dẫn dưới đây là API nội bộ mà trang web của cổng dùng
 * (cùng cách các phần mềm kế toán đang tích hợp). CHƯA kiểm chứng được từ môi trường phát triển (không truy cập được
 * cổng từ ngoài Việt Nam) — phải chạy thử với tài khoản thật. Cổng đổi API thì dùng chức năng nhập file XML thay thế.
 *
 * Captcha do NGƯỜI DÙNG tự nhập mỗi lần đồng bộ (hệ thống không tự giải captcha).
 */
@Component
public class GdtPortalClient {

    private static final DateTimeFormatter DMY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public record Captcha(String key, String svg) {
    }

    private final RestClient http;

    public GdtPortalClient(InternalRestClientFactory httpFactory, @Value("${app.http.external-read-timeout:30s}") Duration externalReadTimeout,
                          @Value("${app.gdt-portal-url}") String baseUrl) {
        this.http = httpFactory.create(baseUrl, externalReadTimeout);
    }

    public Captcha captcha() {
        JsonNode n = call(() -> http.get().uri("/captcha").retrieve().body(JsonNode.class));
        return new Captcha(n.path("key").asText(), n.path("content").asText());
    }

    /** Đăng nhập bằng MST/tài khoản + captcha người dùng nhập → token phiên. */
    public String login(String username, String password, String captchaKey, String captchaValue) {
        try {
            JsonNode n = http.post().uri("/security-taxpayer/authenticate")
                    .body(Map.of("username", username, "password", password, "ckey", captchaKey, "cvalue", captchaValue))
                    .retrieve().body(JsonNode.class);
            String token = n == null ? "" : n.path("token").asText("");
            if (token.isEmpty()) {
                throw BusinessException.badRequest("GDT_LOGIN_FAILED", "Cổng thuế không trả về phiên đăng nhập");
            }
            return token;
        } catch (HttpClientErrorException e) {
            throw BusinessException.badRequest("GDT_LOGIN_FAILED",
                    "Đăng nhập cổng thuế thất bại (sai mật khẩu hoặc mã captcha): " + e.getResponseBodyAsString());
        } catch (ResourceAccessException e) {
            throw unreachable();
        }
    }

    /**
     * Hóa đơn mua vào trong khoảng ngày (cổng giới hạn tối đa ~1 tháng / lần), gồm cả hóa đơn có mã
     * (/query) và hóa đơn khởi tạo từ máy tính tiền (/sco-query).
     */
    public List<JsonNode> purchaseInvoices(String token, LocalDate from, LocalDate to) {
        var all = new ArrayList<JsonNode>();
        String search = "tdlap=ge=" + DMY.format(from) + "T00:00:00;tdlap=le=" + DMY.format(to) + "T23:59:59";
        for (String prefix : List.of("/query", "/sco-query")) {
            String state = null;
            do {
                final String s = state;
                JsonNode page = call(() -> http.get().uri(b -> {
                    b.path(prefix + "/invoices/purchase").queryParam("sort", "tdlap:desc").queryParam("size", 50)
                            .queryParam("search", search);
                    if (s != null) {
                        b.queryParam("state", s);
                    }
                    return b.build();
                }).header("Authorization", "Bearer " + token).retrieve().body(JsonNode.class));
                page.path("datas").forEach(all::add);
                state = page.path("state").isTextual() && !page.path("state").asText().isEmpty() ? page.path("state").asText() : null;
            } while (state != null);
        }
        return all;
    }

    /** Chi tiết 1 hóa đơn (danh sách hàng hóa). sco = hóa đơn máy tính tiền. */
    public JsonNode detail(String token, JsonNode summary, boolean sco) {
        return call(() -> http.get().uri(b -> b.path((sco ? "/sco-query" : "/query") + "/invoices/detail")
                        .queryParam("nbmst", summary.path("nbmst").asText())
                        .queryParam("khhdon", summary.path("khhdon").asText())
                        .queryParam("shdon", summary.path("shdon").asText())
                        .queryParam("khmshdon", summary.path("khmshdon").asText()).build())
                .header("Authorization", "Bearer " + token).retrieve().body(JsonNode.class));
    }

    private static <T> T call(java.util.function.Supplier<T> fn) {
        try {
            T result = fn.get();
            if (result == null) {
                throw BusinessException.upstream("GDT_EMPTY", "Cổng thuế không trả dữ liệu");
            }
            return result;
        } catch (HttpClientErrorException e) {
            throw BusinessException.upstream("GDT_ERROR",
                    "Cổng thuế báo lỗi " + e.getStatusCode().value() + " — phiên có thể đã hết hạn, hãy đồng bộ lại");
        } catch (ResourceAccessException e) {
            throw unreachable();
        }
    }

    private static BusinessException unreachable() {
        return BusinessException.upstream("GDT_UNREACHABLE",
                "Không kết nối được cổng hóa đơn điện tử của cơ quan thuế");
    }
}
