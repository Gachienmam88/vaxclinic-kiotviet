package com.vaxclinic.sales.customer.repository;

import com.vaxclinic.sales.customer.entity.CustomerGroup;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CustomerGroupRepository extends JpaRepository<CustomerGroup, UUID> {

    Optional<CustomerGroup> findByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, UUID id);

    List<CustomerGroup> findAllByOrderByNameAsc();
}
