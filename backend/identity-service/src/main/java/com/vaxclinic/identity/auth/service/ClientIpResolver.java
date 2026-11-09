package com.vaxclinic.identity.auth.service;

import jakarta.servlet.http.HttpServletRequest;

/**
 * IP bên gọi cho giới hạn đăng nhập. Qua gateway: gateway NỐI THÊM IP bên gọi nó vào CUỐI X-Forwarded-For → lấy phần
 * tử cuối (client không giả mạo được phần này; phần đầu thì giả được). Không có header (gọi thẳng) → địa chỉ TCP.
 * Lưu ý: frontend BFF (Next.js) gọi gateway thay trình duyệt nên IP thấy được là IP máy chạy BFF → khi đăng nhập qua
 * web, giới hạn thực tế theo tên đăng nhập.
 */
public final class ClientIpResolver {

    private ClientIpResolver() {
    }

    public static String resolve(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String[] parts = forwarded.split(",");
            String last = parts[parts.length - 1].trim();
            if (!last.isEmpty()) {
                return last;
            }
        }
        return request.getRemoteAddr();
    }
}
