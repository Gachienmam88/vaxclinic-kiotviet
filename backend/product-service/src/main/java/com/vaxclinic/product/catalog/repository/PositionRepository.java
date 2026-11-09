package com.vaxclinic.product.catalog.repository;

import com.vaxclinic.product.catalog.entity.Position;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PositionRepository extends JpaRepository<Position, UUID> {

    List<Position> findAllByOrderByNameAsc();

    boolean existsByNameIgnoreCase(String name);
}
