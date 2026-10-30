package com.vaxclinic.identity.auth;

import jakarta.servlet.http.HttpServletRequest;

import java.net.InetAddress;
import java.net.UnknownHostException;

/**
 * IP người dùng cho giới hạn đăng nhập sai — cùng quy tắc tin cậy với gateway (RateLimitFilter): chỉ đọc PHẦN TỬ ĐẦU của
 * X-Forwarded-For khi bên gọi trực tiếp là loopback / mạng nội bộ (gateway, BFF Next.js — BFF ghi IP trình duyệt vào đầu
 * header, gateway nối thêm IP của BFF phía sau; gateway ghi đè header khi request tới từ ngoài); ngược lại dùng địa chỉ TCP
 * (gọi thẳng từ ngoài không giả được IP).
 */
public final class ClientIpResolver {

    private ClientIpResolver() {
    }

    public static String resolve(HttpServletRequest request) {
        return resolve(request.getRemoteAddr(), request.getHeader("X-Forwarded-For"));
    }

    static String resolve(String remoteAddr, String forwarded) {
        if (trusted(remoteAddr) && forwarded != null && !forwarded.isBlank()) {
            String first = forwarded.split(",")[0].trim();
            if (!first.isEmpty()) {
                return first;
            }
        }
        return remoteAddr;
    }

    /** Loopback hoặc địa chỉ nội bộ (10/8, 172.16/12, 192.168/16, fe80/fc00 IPv6...). Chuỗi IP lạ → không tin. */
    static boolean trusted(String addr) {
        if (addr == null || addr.isBlank() || !addr.matches("[0-9a-fA-F:.%]+")) {
            return false; // chỉ nhận IP dạng số, không phân giải tên miền
        }
        try {
            InetAddress a = InetAddress.getByName(addr);
            return a.isLoopbackAddress() || a.isSiteLocalAddress() || a.isLinkLocalAddress()
                    || (a.getAddress().length == 16 && (a.getAddress()[0] & 0xfe) == 0xfc);
        } catch (UnknownHostException e) {
            return false;
        }
    }
}
