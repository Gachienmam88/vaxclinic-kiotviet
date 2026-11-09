package com.vaxclinic.product.catalog.repository;

import com.vaxclinic.product.catalog.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CategoryRepository extends JpaRepository<Category, UUID> {

    List<Category> findAllByOrderByNameAsc();

    boolean existsByParentId(UUID parentId);
}
