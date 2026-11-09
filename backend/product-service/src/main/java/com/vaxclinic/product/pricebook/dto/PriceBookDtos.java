package com.vaxclinic.product.pricebook.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** DTO của Thiết lập giá (bảng giá + giá theo đơn vị tính). */
public final class PriceBookDtos {

    private PriceBookDtos() {
    }

    /** Hàng không có trong bảng giá: ALLOW = dùng giá chung, BLOCK = chặn, WARN = cho phép kèm cảnh báo. */
    public enum MissingPolicy { ALLOW, BLOCK, WARN }

    public enum Op { PLUS, MINUS }

    /** Gốc tính công thức: giá chung, giá vốn, giá nhập cuối, hoặc 1 bảng giá khác. */
    public enum FormulaBase { BASE_PRICE, COST, LAST_PURCHASE, BOOK }

    /** Phạm vi: null = tất cả; danh sách = chỉ những id được chọn (không được rỗng). */
    public record PriceBookRequest(
            @NotBlank(message = "Nhập tên bảng giá") @Size(max = 150, message = "Tên bảng giá tối đa 150 ký tự") String name,
            @NotNull(message = "Nhập ngày hiệu lực từ") Instant validFrom,
            @NotNull(message = "Nhập ngày hiệu lực đến") Instant validTo,
            boolean active,
            List<UUID> branchIds,
            List<UUID> customerGroupIds,
            List<UUID> sellerIds,
            @NotNull(message = "Chọn cách xử lý hàng không có trong bảng giá") MissingPolicy missingPolicy,
            boolean autoUpdate,
            Op autoOp,
            @DecimalMin(value = "0", message = "Giá trị công thức không được âm") BigDecimal autoValue,
            boolean autoPercent) {
    }

    public record PriceBookResponse(UUID id, String name, Instant validFrom, Instant validTo, boolean active,
                                    List<UUID> branchIds, List<UUID> customerGroupIds, List<UUID> sellerIds,
                                    MissingPolicy missingPolicy, boolean autoUpdate, Op autoOp, BigDecimal autoValue,
                                    boolean autoPercent, long itemCount, String createdByName, Instant createdAt) {
    }

    /** 1 dòng bảng Thiết lập giá = 1 đơn vị tính. prices: giá theo từng bảng giá đang chọn (thiếu = không có trong bảng). */
    public record PriceRow(UUID unitId, UUID productId, String code, String name, String unitName, BigDecimal cost,
                           BigDecimal lastPurchasePrice, BigDecimal basePrice, Map<UUID, BigDecimal> prices) {
    }

    /** price = null → xóa hàng khỏi bảng giá. */
    public record ItemInput(@NotNull UUID unitId, @DecimalMin(value = "0", message = "Giá không được âm") BigDecimal price) {
    }

    public record ItemsRequest(@NotNull @Size(min = 1, max = 2000) List<@Valid ItemInput> items) {
    }

    /** Bộ lọc dòng (giống sidebar): tìm mã/tên, nhóm hàng, tồn kho; inBookOnly = chỉ hàng đã có trong bảng giá. */
    public record RowFilter(String q, List<UUID> categoryIds, String stock, UUID branchId, boolean inBookOnly) {
    }

    /** "Áp dụng công thức": giá mới = gốc ± value (VNĐ hoặc %) cho mọi dòng thuộc bộ lọc. */
    public record FormulaRequest(@NotNull FormulaBase base, UUID baseBookId, @NotNull Op op,
                                 @NotNull @DecimalMin(value = "0", message = "Giá trị không được âm") BigDecimal value,
                                 boolean percent, boolean onlyExisting, String q, List<UUID> categoryIds, String stock,
                                 UUID branchId) {
    }

    public record CountResponse(int updated) {
    }

    /** Nhập file: line = số dòng trong file (để báo lỗi), code = mã hàng, price = chuỗi giá như trong file. */
    public record ImportRow(int line, String code, String price) {
    }

    public record ImportRequest(@NotNull @Size(min = 1, max = 5000) List<ImportRow> rows) {
    }

    public record ImportError(int line, String code, String message) {
    }

    public record ImportResult(int updated, List<ImportError> errors) {
    }
}
