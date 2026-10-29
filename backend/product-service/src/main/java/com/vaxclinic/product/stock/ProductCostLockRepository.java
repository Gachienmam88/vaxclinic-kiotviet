package com.vaxclinic.product.stock;

import com.vaxclinic.product.product.Product;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

/**
 * Khóa dòng products (SELECT … FOR UPDATE) trước khi tính lại giá vốn bình quân: 2 phiếu nhập / trả cùng 1 hàng (cùng hoặc
 * khác chi nhánh) chạy tuần tự trên giá vốn mới nhất thay vì ghi đè nhau. Flush trước để không mất thay đổi chưa ghi của
 * chính transaction (VD dòng trước cùng hàng trong 1 phiếu), rồi nạp lại entity.
 * Dùng FOR NO KEY UPDATE (không phải FOR UPDATE): dòng phiếu nhập vừa INSERT giữ khóa FK FOR KEY SHARE trên products;
 * FOR UPDATE xung đột với khóa đó → 2 phiếu đồng thời deadlock, còn NO KEY UPDATE chỉ loại trừ lẫn nhau.
 */
@Repository
public class ProductCostLockRepository {

    @PersistenceContext
    private EntityManager em;

    public void lockForCost(Product product) {
        em.flush();
        em.createNativeQuery("select 1 from products where id = :id for no key update")
                .setParameter("id", product.getId()).getSingleResult();
        em.refresh(product);
    }
}
