package com.vaxclinic.product.stock.repository;

import com.vaxclinic.product.stock.entity.ProductLot;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProductLotRepository extends JpaRepository<ProductLot, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from ProductLot l where l.productId = ?1 and l.branchId = ?2 and l.lotNumber = ?3")
    Optional<ProductLot> findForUpdate(UUID productId, UUID branchId, String lotNumber);

    Optional<ProductLot> findByProductIdAndBranchIdAndLotNumber(UUID productId, UUID branchId, String lotNumber);

    /** Lô còn hàng, hết hạn trước xếp trước (FEFO). */
    List<ProductLot> findByProductIdAndQuantityGreaterThanOrderByExpiryDateAscLotNumberAsc(
            UUID productId, java.math.BigDecimal minQty);
}
