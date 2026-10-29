package com.vaxclinic.product.purchase;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

/** Danh sách / tìm kiếm NCC kèm công nợ nằm ở {@link SupplierListRepository}; repository chỉ phục vụ ghi. */
public interface SupplierRepository extends JpaRepository<Supplier, UUID> {

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, UUID id);

    Optional<Supplier> findByCodeIgnoreCase(String code);

    @Query(value = "select nextval('supplier_code_seq')", nativeQuery = true)
    long nextCodeNumber();
}
