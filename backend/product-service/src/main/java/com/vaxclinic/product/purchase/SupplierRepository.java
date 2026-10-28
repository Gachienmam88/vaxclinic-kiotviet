package com.vaxclinic.product.purchase;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface SupplierRepository extends JpaRepository<Supplier, UUID> {

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, UUID id);

    @Query(value = "select nextval('supplier_code_seq')", nativeQuery = true)
    long nextCodeNumber();

    /** Tìm theo mã, tên, SĐT, MST; lọc nhóm và trạng thái (null = tất cả). */
    @Query("""
            select s from Supplier s
            where (:q = '' or lower(s.code) like lower(concat('%', :q, '%'))
                   or lower(s.name) like lower(concat('%', :q, '%'))
                   or s.phone like concat('%', :q, '%') or s.taxCode like concat('%', :q, '%'))
              and (:groupName is null or s.groupName = :groupName)
              and (:active is null or s.active = :active)
            """)
    Page<Supplier> search(@Param("q") String q, @Param("groupName") String groupName,
                          @Param("active") Boolean active, Pageable pageable);

    @Query("select distinct s.groupName from Supplier s where s.groupName is not null order by s.groupName")
    List<String> findGroupNames();
}
