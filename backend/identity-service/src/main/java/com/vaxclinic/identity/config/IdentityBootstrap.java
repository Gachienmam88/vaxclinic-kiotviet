package com.vaxclinic.identity.config;

import com.vaxclinic.identity.branch.BranchRepository;
import com.vaxclinic.identity.role.Permissions;
import com.vaxclinic.identity.role.RoleRepository;
import com.vaxclinic.identity.user.AppUser;
import com.vaxclinic.identity.user.AppUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.UUID;

/**
 * Startup tasks:
 * 1. Give the ADMIN role every permission in {@link Permissions#ALL} (new permissions appear automatically).
 * 2. Create the first admin from ADMIN_USERNAME / ADMIN_PASSWORD if it does not exist (no password in source code).
 */
@Configuration
public class IdentityBootstrap {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Component
    static class Runner implements ApplicationRunner {

        private static final Logger log = LoggerFactory.getLogger(Runner.class);

        private final RoleRepository roles;
        private final AppUserRepository users;
        private final BranchRepository branches;
        private final PasswordEncoder passwordEncoder;
        private final String adminUsername;
        private final String adminPassword;

        Runner(RoleRepository roles, AppUserRepository users, BranchRepository branches, PasswordEncoder passwordEncoder,
               @Value("${app.bootstrap.admin-username}") String adminUsername,
               @Value("${app.bootstrap.admin-password}") String adminPassword) {
            this.roles = roles;
            this.users = users;
            this.branches = branches;
            this.passwordEncoder = passwordEncoder;
            this.adminUsername = adminUsername;
            this.adminPassword = adminPassword;
        }

        @Override
        @Transactional
        public void run(ApplicationArguments args) {
            // ADMIN luôn có mọi quyền (kể cả quyền mới thêm). Vai trò khác do người dùng tự chỉnh ở Quản lý vai trò,
            // nên KHÔNG đồng bộ lại — tránh ghi đè quyền họ đã bỏ đi.
            roles.findByCode("ADMIN").ifPresent(admin -> admin.getPermissions().addAll(Permissions.ALL));

            if (users.existsByUsernameIgnoreCase(adminUsername)) {
                return;
            }
            if (adminPassword == null || adminPassword.length() < 8) {
                log.warn("ADMIN_PASSWORD not set (>= 8 chars): skipping first admin creation");
                return;
            }
            var admin = new AppUser();
            admin.setId(UUID.randomUUID());
            admin.setUsername(adminUsername.toLowerCase());
            admin.setPasswordHash(passwordEncoder.encode(adminPassword));
            admin.setFullName(adminUsername.toLowerCase()); // hiển thị như KiotViet: "admin", không phải tên vai trò
            admin.setRole(roles.findByCode("ADMIN").orElseThrow());
            admin.setBranches(new HashSet<>(branches.findAll()));
            users.save(admin);
            log.info("Created first admin user '{}'", adminUsername);
        }
    }
}
