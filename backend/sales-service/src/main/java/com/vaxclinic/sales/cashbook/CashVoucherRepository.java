package com.vaxclinic.sales.cashbook;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface CashVoucherRepository extends JpaRepository<CashVoucher, UUID> {

    Optional<CashVoucher> findBySourceTypeAndSourceId(String sourceType, UUID sourceId);

    @Query(value = "select nextval('receipt_voucher_seq')", nativeQuery = true)
    long nextReceiptNumber();

    @Query(value = "select nextval('payment_voucher_seq')", nativeQuery = true)
    long nextPaymentNumber();
}
