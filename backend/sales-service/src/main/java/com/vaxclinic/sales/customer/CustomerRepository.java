package com.vaxclinic.sales.customer;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID> {

    @Query(value = "select nextval('customer_code_seq')", nativeQuery = true)
    long nextCodeNumber();

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, UUID id);

    /** Khóa dòng khách khi cập nhật công nợ để số dư sổ nợ luôn tuần tự. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Customer c where c.id = ?1")
    Optional<Customer> findForUpdate(UUID id);

    @Query("select g.name from CustomerGroup g order by g.name")
    List<String> findGroupNames();
}
