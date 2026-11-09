package com.vaxclinic.product.purchase.repository;

import com.vaxclinic.product.purchase.entity.PurchaseReceipt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.UUID;

public interface PurchaseReceiptRepository extends JpaRepository<PurchaseReceipt, UUID> {

    @Query(value = "select nextval('purchase_receipt_code_seq')", nativeQuery = true)
    long nextCodeNumber();

    boolean existsByCode(String code);
}
