package com.vaxclinic.product.catalog;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/** Repositories for small lookup tables of the catalog. */
public final class CatalogRepositories {

    private CatalogRepositories() {
    }

    public interface CategoryRepository extends JpaRepository<Category, UUID> {
        List<Category> findAllByOrderByNameAsc();

        boolean existsByParentId(UUID parentId);
    }

    public interface TaxRateRepository extends JpaRepository<TaxRate, UUID> {
        List<TaxRate> findAllByOrderBySortOrderAsc();
    }

    public interface PositionRepository extends JpaRepository<Position, UUID> {
        List<Position> findAllByOrderByNameAsc();

        boolean existsByNameIgnoreCase(String name);
    }
}
