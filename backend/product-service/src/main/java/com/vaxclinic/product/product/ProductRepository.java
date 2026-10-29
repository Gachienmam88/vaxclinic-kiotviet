package com.vaxclinic.product.product;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {

    boolean existsByCategoryIdAndDeletedFalse(UUID categoryId);

    /** [categoryId, số hàng hóa chưa xóa] cho mỗi nhóm hàng có hàng (hiển thị "Tên (số hàng)" ở bộ chọn nhóm hàng). */
    @Query("select p.categoryId, count(p) from Product p where not p.deleted and p.categoryId is not null group by p.categoryId")
    List<Object[]> countByCategory();

    @Query("select count(u) > 0 from ProductUnit u where lower(u.code) = lower(?1)")
    boolean existsUnitCode(String code);

    @Query("select count(u) > 0 from ProductUnit u where lower(u.code) = lower(?1) and u.id <> ?2")
    boolean existsUnitCodeExcept(String code, UUID unitId);

    /** Next auto code SP000001, SP000002... from a DB sequence (safe under concurrency). */
    @Query(value = "select nextval('product_code_seq')", nativeQuery = true)
    long nextCodeNumber();
}
