package com.vaxclinic.identity.auth;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** IP cho giới hạn đăng nhập sai: tin X-Forwarded-For (phần tử đầu) chỉ khi bên gọi là loopback / nội bộ. */
class ClientIpResolverTest {

    @Test
    void trustedPeerUsesFirstForwardedAddress() {
        assertEquals("203.0.113.7", ClientIpResolver.resolve("127.0.0.1", "203.0.113.7, 10.0.0.5"));
        assertEquals("203.0.113.7", ClientIpResolver.resolve("10.1.2.3", "203.0.113.7"));
        assertEquals("203.0.113.7", ClientIpResolver.resolve("0:0:0:0:0:0:0:1", "203.0.113.7"));
        assertEquals("203.0.113.7", ClientIpResolver.resolve("192.168.1.20", " 203.0.113.7 ,192.168.1.20"));
    }

    @Test
    void untrustedPeerIgnoresForwardedHeader() {
        assertEquals("198.51.100.9", ClientIpResolver.resolve("198.51.100.9", "1.2.3.4"));
    }

    @Test
    void missingHeaderUsesRemoteAddress() {
        assertEquals("127.0.0.1", ClientIpResolver.resolve("127.0.0.1", null));
        assertEquals("127.0.0.1", ClientIpResolver.resolve("127.0.0.1", "  "));
    }
}
