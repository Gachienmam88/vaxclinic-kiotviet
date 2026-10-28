package com.vaxclinic.sales.order;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface CustomerOrderRepository extends JpaRepository<CustomerOrder, UUID> {

    @Query(value = "select nextval('order_code_seq')", nativeQuery = true)
    long nextCodeNumber();

    /** Khóa dòng đơn: sửa / hủy / tạo hóa đơn cùng lúc không chồng nhau. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from CustomerOrder o where o.id = ?1")
    Optional<CustomerOrder> findForUpdate(UUID id);
}
