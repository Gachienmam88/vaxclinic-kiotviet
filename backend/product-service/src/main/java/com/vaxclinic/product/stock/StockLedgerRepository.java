package com.vaxclinic.product.stock;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface StockLedgerRepository extends JpaRepository<StockLedgerEntry, UUID> {

    Page<StockLedgerEntry> findByProductIdOrderByOccurredAtDesc(UUID productId, Pageable pageable);

    Page<StockLedgerEntry> findByProductIdAndBranchIdOrderByOccurredAtDesc(UUID productId, UUID branchId,
                                                                          Pageable pageable);

    boolean existsByProductId(UUID productId);
}
