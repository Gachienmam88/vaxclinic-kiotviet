package com.vaxclinic.sales.invoice;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {

    @Query(value = "select nextval('invoice_code_seq')", nativeQuery = true)
    long nextCodeNumber();

    /** Hóa đơn kèm dòng hàng — dùng ngoài transaction (lines là LAZY). */
    @Query("select distinct i from Invoice i left join fetch i.lines where i.id = ?1")
    Optional<Invoice> findWithLines(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Invoice i where i.id = ?1")
    Optional<Invoice> findForUpdate(UUID id);

    /** Hóa đơn còn nợ của khách, cũ trước (phân bổ phiếu thu tự động theo thứ tự). */
    @Query("select i from Invoice i where i.customerId = ?1 and i.status = 'COMPLETED' and i.paid < i.total order by i.soldAt asc")
    List<Invoice> findUnpaidByCustomer(UUID customerId);
}
