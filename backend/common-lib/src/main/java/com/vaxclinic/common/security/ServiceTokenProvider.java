package com.vaxclinic.common.security;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Short-lived JWT for service-to-service calls (e.g. sales-service → product-service /internal/**).
 * Carries the single permission "internal"; internal endpoints require hasAuthority('internal').
 * Internal endpoints are NOT routed by the gateway, so browsers can never reach them.
 */
public class ServiceTokenProvider {

    public static final String INTERNAL = "internal";

    private final NimbusJwtEncoder encoder;
    private final String serviceName;
    private String cached;
    private Instant cachedUntil = Instant.EPOCH;

    public ServiceTokenProvider(String secret, String serviceName) {
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(JwtSecretKeys.hs256(secret)));
        this.serviceName = serviceName;
    }

    public synchronized String token() {
        Instant now = Instant.now();
        if (cached == null || now.isAfter(cachedUntil)) {
            var claims = JwtClaimsSet.builder().issuer("vaxclinic-" + serviceName).subject("service:" + serviceName)
                    .issuedAt(now).expiresAt(now.plus(Duration.ofMinutes(10)))
                    .claim("perms", List.of(INTERNAL)).claim("name", serviceName).claim("branches", List.of()).build();
            cached = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                    .getTokenValue();
            cachedUntil = now.plus(Duration.ofMinutes(8));
        }
        return cached;
    }
}
