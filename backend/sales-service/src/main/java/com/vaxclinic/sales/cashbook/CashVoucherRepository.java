package com.vaxclinic.sales.cashbook;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CashVoucherRepository extends JpaRepository<CashVoucher, UUID> {

    Optional<CashVoucher> findBySourceTypeAndSourceId(String sourceType, UUID sourceId);

    /** Nguồn sinh nhiều phiếu (INVOICE_EXTRA: phiếu thu thêm của hóa đơn thanh toán nhiều phương thức). */
    List<CashVoucher> findBySourceTypeAndSourceIdOrderByCodeAsc(String sourceType, UUID sourceId);

    @Query(value = "select nextval('receipt_voucher_seq')", nativeQuery = true)
    long nextReceiptNumber();

    @Query(value = "select nextval('payment_voucher_seq')", nativeQuery = true)
    long nextPaymentNumber();
}
