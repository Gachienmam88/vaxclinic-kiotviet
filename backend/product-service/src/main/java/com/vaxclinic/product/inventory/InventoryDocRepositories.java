package com.vaxclinic.product.inventory;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.UUID;

/** Repository phiếu kiểm kho và phiếu xuất hủy / xuất dùng nội bộ (mỗi loại 1 sequence đánh mã). */
final class InventoryDocRepositories {

    private InventoryDocRepositories() {
    }

    interface StockTakeRepository extends JpaRepository<StockTake, UUID> {
        @Query(value = "select nextval('stock_take_code_seq')", nativeQuery = true)
        long nextCodeNumber();
    }

    interface StockIssueRepository extends JpaRepository<StockIssue, UUID> {
        @Query(value = "select nextval('stock_damage_code_seq')", nativeQuery = true)
        long nextDamageNumber();

        @Query(value = "select nextval('stock_internal_code_seq')", nativeQuery = true)
        long nextInternalNumber();
    }
}
