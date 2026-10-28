package com.vaxclinic.common.http;

import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

/**
 * Tạo RestClient cho mọi cuộc gọi HTTP giữa các dịch vụ (và ra ngoài: MISA, cổng thuế) — LUÔN có timeout.
 * Không có timeout, 1 dịch vụ treo (GC dài, DB khóa) giữ luồng gọi vô hạn → quầy thu ngân treo theo.
 * - connect-timeout: thời gian tối đa mở kết nối TCP (mặc định 2 s, app.http.connect-timeout);
 * - read-timeout: thời gian tối đa chờ phản hồi (mặc định 5 s, app.http.read-timeout); từng client có thể đặt riêng
 *   (VD trừ kho 10 s, MISA / cổng thuế 30 s).
 * Hết thời gian → {@link org.springframework.web.client.ResourceAccessException} (như lỗi mạng).
 * Một java.net.http.HttpClient dùng chung cho mọi RestClient tạo ra (tránh mỗi client 1 luồng selector riêng).
 */
public class InternalRestClientFactory {

    public static final Duration DEFAULT_CONNECT_TIMEOUT = Duration.ofSeconds(2);
    public static final Duration DEFAULT_READ_TIMEOUT = Duration.ofSeconds(5);

    private final HttpClient httpClient;
    private final Duration readTimeout;

    public InternalRestClientFactory(Duration connectTimeout, Duration readTimeout) {
        this.httpClient = HttpClient.newBuilder().connectTimeout(connectTimeout).build();
        this.readTimeout = readTimeout;
    }

    /** Factory với timeout mặc định (2 s / 5 s) — cho code không chạy trong Spring context (test, công cụ). */
    public static InternalRestClientFactory defaults() {
        return new InternalRestClientFactory(DEFAULT_CONNECT_TIMEOUT, DEFAULT_READ_TIMEOUT);
    }

    /** RestClient tới baseUrl với read-timeout mặc định của factory. */
    public RestClient create(String baseUrl) {
        return create(baseUrl, readTimeout);
    }

    /** RestClient tới baseUrl với read-timeout riêng (VD trừ kho 10 s, MISA 30 s). */
    public RestClient create(String baseUrl, Duration customReadTimeout) {
        var requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(customReadTimeout);
        return RestClient.builder().baseUrl(baseUrl).requestFactory(requestFactory).build();
    }
}
