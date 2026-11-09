package com.vaxclinic.identity.user.repository;

import com.vaxclinic.identity.user.entity.AppUser;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {

    Optional<AppUser> findByUsernameIgnoreCase(String username);

    boolean existsByUsernameIgnoreCase(String username);

    Optional<AppUser> findFirstByOwnerTrue();

    /** Tìm theo tên đăng nhập / họ tên / SĐT; q rỗng = tất cả. */
    @Query("""
            select u from AppUser u
            where :q = '' or lower(u.username) like lower(concat('%', :q, '%'))
               or function('immutable_unaccent' as String, lower(u.fullName)) like function('immutable_unaccent' as String, lower(concat('%', :q, '%')))
               or u.phone like concat('%', :q, '%')
            """)
    Page<AppUser> search(@Param("q") String q, Pageable pageable);
}
