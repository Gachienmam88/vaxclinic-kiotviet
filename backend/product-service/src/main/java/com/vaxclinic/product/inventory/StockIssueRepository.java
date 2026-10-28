package com.vaxclinic.product.inventory;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.UUID;

/** Mỗi loại phiếu 1 sequence đánh mã: XH000001, XNB000001. */
public interface StockIssueRepository extends JpaRepository<StockIssue, UUID> {

    @Query(value = "select nextval('stock_damage_code_seq')", nativeQuery = true)
    long nextDamageNumber();

    @Query(value = "select nextval('stock_internal_code_seq')", nativeQuery = true)
    long nextInternalNumber();
}
