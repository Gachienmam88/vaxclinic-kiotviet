package com.vaxclinic.product.purchase.repository;

import com.vaxclinic.product.purchase.entity.DocStatus;
import com.vaxclinic.product.purchase.entity.PurchaseReturn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface PurchaseReturnRepository extends JpaRepository<PurchaseReturn, UUID> {

    @Query(value = "select nextval('purchase_return_code_seq')", nativeQuery = true)
    long nextCodeNumber();

    boolean existsByReceiptIdAndStatusNot(UUID receiptId, DocStatus status);

    List<PurchaseReturn> findByReceiptIdAndStatus(UUID receiptId, DocStatus status);
}
