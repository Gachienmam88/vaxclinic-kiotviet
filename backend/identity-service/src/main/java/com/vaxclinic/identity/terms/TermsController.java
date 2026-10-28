package com.vaxclinic.identity.terms;

import com.vaxclinic.identity.terms.TermsService.TermsStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Điều khoản sử dụng của user đang đăng nhập. Luồng: TermsController → TermsService → TermsAcceptanceRepository. */
@RestController
public class TermsController {

    public record AcceptRequest(String version) {
    }

    private final TermsService service;

    public TermsController(TermsService service) {
        this.service = service;
    }

    @GetMapping("/api/auth/terms")
    public TermsStatus status(@AuthenticationPrincipal Jwt jwt) {
        return service.status(UUID.fromString(jwt.getSubject()));
    }

    @PostMapping("/api/auth/terms/accept")
    public TermsStatus accept(@RequestBody AcceptRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.accept(UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"), req.version());
    }
}
