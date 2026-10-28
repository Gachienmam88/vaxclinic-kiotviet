package com.vaxclinic.product.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TaxRateRepository extends JpaRepository<TaxRate, UUID> {

    List<TaxRate> findAllByOrderBySortOrderAsc();
}
