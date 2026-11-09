package com.vaxclinic.identity.user.entity;

import com.vaxclinic.identity.branch.entity.Branch;
import com.vaxclinic.identity.role.entity.Role;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/** Nhân viên đăng nhập hệ thống. Mỗi user có 1 vai trò và được làm ở 1..n điểm tiêm. */
@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
public class AppUser {

    @Id
    private UUID id;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    private String phone;

    @Column(nullable = false)
    private boolean active = true;

    /** Chủ gian hàng (đúng 1 user, vai trò ADMIN): đổi tên, bảo lưu, chuyển nhượng gian hàng. */
    @Column(nullable = false)
    private boolean owner;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "role_id")
    private Role role;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "user_branches",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "branch_id"))
    private Set<Branch> branches = new HashSet<>();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
