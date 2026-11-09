package com.vaxclinic.sales.customer.service;

import com.vaxclinic.sales.customer.entity.CustomerGroup;
import com.vaxclinic.sales.customer.repository.CustomerGroupRepository;
import com.vaxclinic.common.error.BusinessException;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static com.vaxclinic.sales.common.Actor.blankToNull;

/**
 * Nhóm khách hàng: thêm / sửa / xóa. customers.group_name là bản sao tên nhóm (API cũ đọc trường này),
 * nên đổi tên nhóm cập nhật luôn khách thuộc nhóm. Xóa nhóm: khách trong nhóm trở thành "chưa có nhóm" (như KiotViet).
 */
@Service
public class CustomerGroupService {

    public record GroupRequest(@NotBlank(message = "Nhập tên nhóm") @Size(max = 100) String name,
                               @Pattern(regexp = "PERCENT|AMOUNT", message = "Kiểu giảm giá không hợp lệ") String discountType,
                               @DecimalMin(value = "0", message = "Giảm giá không được âm") BigDecimal discountValue,
                               @Size(max = 500) String note) {
    }

    public record GroupResponse(UUID id, String name, String discountType, BigDecimal discountValue, String note,
                                long customerCount, Instant createdAt) {
    }

    private final CustomerGroupRepository groups;
    private final JdbcTemplate jdbc;

    public CustomerGroupService(CustomerGroupRepository groups, JdbcTemplate jdbc) {
        this.groups = groups;
        this.jdbc = jdbc;
    }

    public List<GroupResponse> list() {
        Map<UUID, Long> counts = new HashMap<>();
        jdbc.query("select group_id, count(*) from customers where group_id is not null and active group by group_id",
                rs -> {
                    counts.put(rs.getObject(1, UUID.class), rs.getLong(2));
                });
        return groups.findAllByOrderByNameAsc().stream().map(g -> response(g, counts.getOrDefault(g.getId(), 0L))).toList();
    }

    @Transactional
    public GroupResponse create(GroupRequest req) {
        String name = req.name().trim();
        if (groups.findByNameIgnoreCase(name).isPresent()) {
            throw BusinessException.conflict("GROUP_NAME_EXISTS", "Tên nhóm khách hàng đã tồn tại");
        }
        var g = new CustomerGroup();
        g.setId(UUID.randomUUID());
        apply(g, req, name);
        return response(groups.save(g), 0);
    }

    @Transactional
    public GroupResponse update(UUID id, GroupRequest req) {
        var g = find(id);
        String name = req.name().trim();
        if (groups.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw BusinessException.conflict("GROUP_NAME_EXISTS", "Tên nhóm khách hàng đã tồn tại");
        }
        apply(g, req, name);
        jdbc.update("update customers set group_name = ? where group_id = ?", name, id);
        return response(g, count(id));
    }

    /** Xóa nhóm; khách trong nhóm được bỏ nhóm. Trả về số khách bị bỏ nhóm. */
    @Transactional
    public int delete(UUID id) {
        var g = find(id);
        int unlinked = jdbc.update("update customers set group_id = null, group_name = null where group_id = ?", id);
        groups.delete(g);
        return unlinked;
    }

    public CustomerGroup find(UUID id) {
        return groups.findById(id)
                .orElseThrow(() -> BusinessException.notFound("GROUP_NOT_FOUND", "Không tìm thấy nhóm khách hàng"));
    }

    private long count(UUID id) {
        Long n = jdbc.queryForObject("select count(*) from customers where group_id = ? and active", Long.class, id);
        return n == null ? 0 : n;
    }

    private static void apply(CustomerGroup g, GroupRequest req, String name) {
        String type = req.discountType() == null ? "PERCENT" : req.discountType();
        BigDecimal value = req.discountValue() == null ? BigDecimal.ZERO : req.discountValue();
        if ("PERCENT".equals(type) && value.compareTo(BigDecimal.valueOf(100)) > 0) {
            throw BusinessException.badRequest("GROUP_DISCOUNT_INVALID", "Giảm giá theo % không được vượt quá 100%");
        }
        g.setName(name);
        g.setDiscountType(type);
        g.setDiscountValue(value);
        g.setNote(blankToNull(req.note()));
    }

    private static GroupResponse response(CustomerGroup g, long count) {
        return new GroupResponse(g.getId(), g.getName(), g.getDiscountType(), g.getDiscountValue(), g.getNote(), count,
                g.getCreatedAt());
    }
}
