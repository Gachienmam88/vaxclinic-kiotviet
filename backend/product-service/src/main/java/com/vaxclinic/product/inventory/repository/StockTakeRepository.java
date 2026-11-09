package com.vaxclinic.product.inventory.repository;

import com.vaxclinic.product.inventory.entity.StockTake;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.UUID;

public interface StockTakeRepository extends JpaRepository<StockTake, UUID> {

    @Query(value = "select nextval('stock_take_code_seq')", nativeQuery = true)
    long nextCodeNumber();
}
