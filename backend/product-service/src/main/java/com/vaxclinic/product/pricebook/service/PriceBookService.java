package com.vaxclinic.product.pricebook.service;

import com.vaxclinic.product.pricebook.dto.PriceBookDtos;
import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.MissingPolicy;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.Op;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.PriceBookRequest;
import com.vaxclinic.product.pricebook.dto.PriceBookDtos.PriceBookResponse;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/** Bảng giá: thêm / sửa / xóa + kiểm tra hợp lệ (tên không trùng, hiệu lực từ < đến, phạm vi không rỗng). */
@Service
public class PriceBookService {

    private static final String SELECT = """
            select b.*, (select count(*) from price_book_items i where i.price_book_id = b.id) item_count
            from price_books b""";

    private final NamedParameterJdbcTemplate jdbc;

    public PriceBookService(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<PriceBookResponse> list() {
        return jdbc.query(SELECT + " order by lower(b.name)", (rs, i) -> map(rs));
    }

    public PriceBookResponse get(UUID id) {
        return jdbc.query(SELECT + " where b.id = :id", new MapSqlParameterSource("id", id), (rs, i) -> map(rs))
                .stream().findFirst()
                .orElseThrow(() -> BusinessException.notFound("PRICE_BOOK_NOT_FOUND", "Không tìm thấy bảng giá"));
    }

    @Transactional
    public UUID create(PriceBookRequest req, UUID userId, String userName) {
        validate(req);
        UUID id = UUID.randomUUID();
        var p = params(req).addValue("id", id).addValue("createdBy", userId)
                .addValue("createdByName", userName == null ? "" : userName);
        save(() -> jdbc.update("""
                insert into price_books (id, name, valid_from, valid_to, active, branch_ids, customer_group_ids, seller_ids,
                    missing_policy, auto_update, auto_op, auto_value, auto_percent, created_by, created_by_name)
                values (:id, :name, :validFrom, :validTo, :active, cast(:branchIds as uuid[]), cast(:groupIds as uuid[]),
                    cast(:sellerIds as uuid[]), :policy, :autoUpdate, :autoOp, :autoValue, :autoPercent, :createdBy,
                    :createdByName)""", p));
        return id;
    }

    @Transactional
    public void update(UUID id, PriceBookRequest req) {
        get(id);
        validate(req);
        var p = params(req).addValue("id", id);
        save(() -> jdbc.update("""
                update price_books set name = :name, valid_from = :validFrom, valid_to = :validTo, active = :active,
                    branch_ids = cast(:branchIds as uuid[]), customer_group_ids = cast(:groupIds as uuid[]),
                    seller_ids = cast(:sellerIds as uuid[]), missing_policy = :policy, auto_update = :autoUpdate,
                    auto_op = :autoOp, auto_value = :autoValue, auto_percent = :autoPercent, updated_at = now()
                where id = :id""", p));
        if (req.autoUpdate()) {
            // Bật tự cập nhật → tính lại ngay các dòng đang có theo giá chung hiện tại.
            jdbc.update("""
                    update price_book_items i set price = price_book_formula(u.price, :autoOp, :autoValue, :autoPercent),
                        updated_at = now()
                    from product_units u where u.id = i.unit_id and i.price_book_id = :id""", p);
        }
    }

    @Transactional
    public void delete(UUID id) {
        get(id);
        jdbc.update("delete from price_books where id = :id", new MapSqlParameterSource("id", id));
    }

    private static void validate(PriceBookRequest req) {
        if (!req.validFrom().isBefore(req.validTo())) {
            throw BusinessException.badRequest("PRICE_BOOK_VALIDITY", "Ngày hiệu lực đến phải sau ngày hiệu lực từ");
        }
        checkScope(req.branchIds(), "chi nhánh");
        checkScope(req.customerGroupIds(), "nhóm khách hàng");
        checkScope(req.sellerIds(), "người tạo giao dịch");
    }

    private static void checkScope(List<UUID> ids, String label) {
        if (ids != null && ids.isEmpty()) {
            throw BusinessException.badRequest("PRICE_BOOK_SCOPE", "Chọn ít nhất 1 " + label + " hoặc chọn Tất cả");
        }
    }

    private static void save(Runnable write) {
        try {
            write.run();
        } catch (DuplicateKeyException e) {
            throw BusinessException.conflict("PRICE_BOOK_NAME_DUPLICATE", "Tên bảng giá đã tồn tại");
        }
    }

    private static MapSqlParameterSource params(PriceBookRequest req) {
        return new MapSqlParameterSource()
                .addValue("name", req.name().trim())
                .addValue("validFrom", Timestamp.from(req.validFrom()))
                .addValue("validTo", Timestamp.from(req.validTo()))
                .addValue("active", req.active())
                .addValue("branchIds", pgArray(req.branchIds()))
                .addValue("groupIds", pgArray(req.customerGroupIds()))
                .addValue("sellerIds", pgArray(req.sellerIds()))
                .addValue("policy", req.missingPolicy().name())
                .addValue("autoUpdate", req.autoUpdate())
                .addValue("autoOp", (req.autoOp() == null ? Op.PLUS : req.autoOp()).name())
                .addValue("autoValue", req.autoValue() == null ? BigDecimal.ZERO : req.autoValue())
                .addValue("autoPercent", req.autoPercent());
    }

    /** Mảng uuid dạng literal Postgres "{a,b}" (cast ở SQL); null = tất cả. */
    static String pgArray(List<UUID> ids) {
        return ids == null ? null : ids.stream().distinct().map(UUID::toString).collect(Collectors.joining(",", "{", "}"));
    }

    static List<UUID> uuids(ResultSet rs, String col) throws SQLException {
        java.sql.Array a = rs.getArray(col);
        return a == null ? null : Arrays.stream((Object[]) a.getArray()).map(o -> UUID.fromString(o.toString())).toList();
    }

    private static PriceBookResponse map(ResultSet rs) throws SQLException {
        return new PriceBookResponse(rs.getObject("id", UUID.class), rs.getString("name"),
                rs.getTimestamp("valid_from").toInstant(), rs.getTimestamp("valid_to").toInstant(), rs.getBoolean("active"),
                uuids(rs, "branch_ids"), uuids(rs, "customer_group_ids"), uuids(rs, "seller_ids"),
                MissingPolicy.valueOf(rs.getString("missing_policy")), rs.getBoolean("auto_update"),
                Op.valueOf(rs.getString("auto_op")), rs.getBigDecimal("auto_value"), rs.getBoolean("auto_percent"),
                rs.getLong("item_count"), rs.getString("created_by_name"), rs.getTimestamp("created_at").toInstant());
    }
}
