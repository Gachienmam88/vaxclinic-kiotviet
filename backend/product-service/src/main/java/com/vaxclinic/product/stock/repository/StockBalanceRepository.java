package com.vaxclinic.product.stock.repository;

import com.vaxclinic.product.stock.entity.StockBalance;
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
}
