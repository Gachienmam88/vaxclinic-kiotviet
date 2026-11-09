package com.vaxclinic.identity.notification.dto;

import org.springframework.security.oauth2.jwt.Jwt;

import java.util.List;
import java.util.UUID;

/** Người xem hộp thư: chỉ thấy thông báo của chi nhánh mình làm việc (hoặc mọi chi nhánh) và đúng quyền mình có. */
public record NotificationViewer(UUID userId, String name, String[] branchIds, String[] permissions) {

    public static NotificationViewer of(Jwt jwt) {
        List<String> branches = jwt.getClaimAsStringList("branches");
        List<String> perms = jwt.getClaimAsStringList("perms");
        return new NotificationViewer(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"),
                branches == null ? new String[0] : branches.toArray(String[]::new),
                perms == null ? new String[0] : perms.toArray(String[]::new));
    }
}
