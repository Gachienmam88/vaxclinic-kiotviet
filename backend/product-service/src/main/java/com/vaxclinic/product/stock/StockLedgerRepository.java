package com.vaxclinic.product.stock;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface StockLedgerRepository extends JpaRepository<StockLedgerEntry, UUID> {

    Page<StockLedgerEntry> findByProductIdOrderByOccurredAtDescSeqDesc(UUID productId, Pageable pageable);

    Page<StockLedgerEntry> findByProductIdAndBranchIdOrderByOccurredAtDescSeqDesc(UUID productId, UUID branchId,
                                                                                Pageable pageable);

    List<StockLedgerEntry> findByDocId(UUID docId);

    /** Có dòng thẻ kho nào của (hàng, chi nhánh) sau thời điểm at → dòng mới là lùi ngày, phải tính lại tồn sau giao dịch. */
    @Query(value = "select exists(select 1 from stock_ledger where product_id = :p and branch_id = :b and occurred_at > :at)",
            nativeQuery = true)
    boolean hasRowsAfter(@Param("p") UUID productId, @Param("b") UUID branchId, @Param("at") Instant at);

    /**
     * Tính lại balance_after của mọi dòng (hàng, chi nhánh) theo thứ tự (occurred_at, seq): tồn sau dòng = tồn hiện tại
     * (stock_balances) − Σ SL các dòng ghi sau nó. Chỉ cập nhật dòng lệch. Gọi sau khi đã flush dòng mới + tồn.
     */
    @Modifying
    @Query(value = """
            update stock_ledger l set balance_after = x.bal
            from (select id, coalesce((select quantity from stock_balances where product_id = :p and branch_id = :b), 0)
                             - sum(quantity) over (order by occurred_at desc, seq desc rows between unbounded preceding and current row)
                             + quantity as bal
                  from stock_ledger where product_id = :p and branch_id = :b) x
            where l.id = x.id and l.balance_after <> x.bal""", nativeQuery = true)
    int recomputeBalances(@Param("p") UUID productId, @Param("b") UUID branchId);

    boolean existsByProductId(UUID productId);
}
