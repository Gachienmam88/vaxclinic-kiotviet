package com.vaxclinic.identity.terms;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/** Bảng terms_acceptances: user đã đồng ý phiên bản điều khoản nào, lúc nào. */
@Repository
public class TermsAcceptanceRepository {

    private final JdbcTemplate jdbc;

    public TermsAcceptanceRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Instant> findAcceptedAt(UUID userId, String version) {
        return jdbc.queryForList("select accepted_at from terms_acceptances where user_id = ? and version = ?",
                Timestamp.class, userId, version).stream().findFirst().map(Timestamp::toInstant);
    }

    /** true nếu là lần đồng ý đầu tiên của phiên bản này. */
    public boolean insertIfAbsent(UUID userId, String version) {
        return jdbc.update("insert into terms_acceptances(user_id, version) values (?, ?) on conflict do nothing", userId, version) > 0;
    }
}
