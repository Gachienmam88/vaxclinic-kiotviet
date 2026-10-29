package com.vaxclinic.product.product;

import com.vaxclinic.product.product.ProductDtos.ProductSupplier;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Số liệu phụ của chi tiết hàng hóa (kiểu KiotViet): khối "Nhà cung cấp" và cột "Dự kiến hết hàng" theo từng chi nhánh
 * ở tab Tồn kho. SQL thuần vì cần group by qua phiếu nhập / thẻ kho.
 */
@Repository
public class ProductDetailInsightRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public ProductDetailInsightRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** NCC đã nhập hàng này (phiếu nhập đã hoàn thành, chưa hủy), NCC nhập gần nhất trước. */
    public List<ProductSupplier> suppliers(UUID productId) {
        return jdbc.query("""
                select s.id, s.code, s.name, max(r.received_at) last_at
                from purchase_receipts r
                join suppliers s on s.id = r.supplier_id
                where r.status = 'COMPLETED'
                  and exists (select 1 from purchase_receipt_lines l where l.receipt_id = r.id and l.product_id = :pid)
                group by s.id, s.code, s.name
                order by last_at desc, s.code
                """, Map.of("pid", productId),
                (rs, i) -> new ProductSupplier(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name")));
    }

    /**
     * Dự kiến hết hàng theo chi nhánh: cùng công thức với danh sách ({@link ProductListRepository}) nhưng tồn và bán ròng
     * 30 ngày tính riêng từng chi nhánh. Chi nhánh chưa bán ròng gì (≤ 0) không có trong map (= null).
     */
    public Map<UUID, Integer> expectedOutDaysByBranch(UUID productId) {
        return jdbc.query("""
                select b.branch_id, floor(greatest(b.quantity, 0) * least(30,
                           greatest(1, ceil(extract(epoch from now() - p.created_at) / 86400))) / v.sold)::int days
                from stock_balances b
                join products p on p.id = b.product_id
                join (select l.branch_id, -sum(l.quantity) sold from stock_ledger l
                      where l.product_id = :pid
                        and l.doc_type in ('SALE', 'SALE_CANCEL', 'SALE_RETURN', 'SALE_RETURN_CANCEL_OUT')
                        and l.occurred_at >= now() - interval '30 days'
                      group by l.branch_id) v on v.branch_id = b.branch_id
                where b.product_id = :pid and v.sold > 0
                """, Map.of("pid", productId),
                (rs, i) -> Map.entry(rs.getObject("branch_id", UUID.class), rs.getInt("days")))
                .stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }
}
