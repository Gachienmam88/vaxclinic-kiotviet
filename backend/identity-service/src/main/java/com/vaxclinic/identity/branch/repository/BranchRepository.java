package com.vaxclinic.identity.branch.repository;

import com.vaxclinic.identity.branch.entity.Branch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BranchRepository extends JpaRepository<Branch, UUID> {

    boolean existsByCode(String code);

    List<Branch> findAllByOrderByCodeAsc();

    long countByActiveTrue();
}
