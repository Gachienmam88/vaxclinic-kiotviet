package com.vaxclinic.identity.auth;

import com.vaxclinic.common.security.JwtSecretKeys;
import com.vaxclinic.identity.branch.Branch;
import com.vaxclinic.identity.user.AppUser;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;

/** Issues short-lived access JWTs and generates/hashes opaque refresh tokens. */
@Component
public class TokenService {

    private final JwtEncoder encoder;
    private final Duration accessTtl;
    private final SecureRandom random = new SecureRandom();

    public TokenService(@Value("${app.jwt.secret}") String secret,
                        @Value("${app.jwt.access-ttl-minutes}") long accessTtlMinutes) {
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(JwtSecretKeys.hs256(secret)));
        this.accessTtl = Duration.ofMinutes(accessTtlMinutes);
    }

    public String issueAccessToken(AppUser user) {
        Instant now = Instant.now();
        List<String> branchIds = user.getBranches().stream().map(Branch::getId).map(Object::toString).toList();
        var claims = JwtClaimsSet.builder()
                .issuer("vaxclinic-identity")
                .subject(user.getId().toString())
                .issuedAt(now)
                .expiresAt(now.plus(accessTtl))
                .claim("username", user.getUsername())
                .claim("name", user.getFullName())
                .claim("role", user.getRole().getCode())
                .claim("perms", List.copyOf(user.getRole().getPermissions()))
                .claim("branches", branchIds)
                .build();
        var header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    public long accessTtlSeconds() {
        return accessTtl.toSeconds();
    }

    public String newRefreshToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String sha256(String value) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
