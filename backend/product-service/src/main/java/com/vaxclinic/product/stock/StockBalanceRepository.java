package com.vaxclinic.product.stock;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface StockBalanceRepository extends JpaRepository<StockBalance, StockBalance.Key> {

    /** Row lock so concurrent sales/imports of the same item at the same branch are serialized. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from StockBalance b where b.id = ?1")
    Optional<StockBalance> findForUpdate(StockBalance.Key key);

    java.util.List<StockBalance> findByIdProductId(java.util.UUID productId);

    /** Tổng tồn của hàng ở các chi nhánh KHÁC (giá vốn là 1 giá chung cho cả cửa hàng → bình quân theo tồn toàn cửa hàng). */
    @Query("select coalesce(sum(b.quantity), 0) from StockBalance b where b.id.productId = ?1 and b.id.branchId <> ?2")
    java.math.BigDecimal sumOtherBranches(java.util.UUID productId, java.util.UUID branchId);
}
