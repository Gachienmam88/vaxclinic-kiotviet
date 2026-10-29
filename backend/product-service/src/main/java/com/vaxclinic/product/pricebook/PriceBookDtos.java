package com.vaxclinic.product.pricebook;

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

    /**
     * Gốc tính công thức: giá chung, giá vốn, giá nhập cuối, 1 bảng giá khác, hoặc CURRENT = giá hiện tại của chính cột
     * đang đặt giá (bảng giá đích / giá chung). CURRENT không dùng cho công thức lưu trong bảng giá.
     */
    public enum FormulaBase { BASE_PRICE, COST, LAST_PURCHASE, BOOK, CURRENT }

    /** Lọc "Giá bán": so sánh giá (bảng giá đầu tiên đang chọn hoặc giá chung) với giá vốn / giá nhập cuối. */
    public enum PriceCompare { LT, LTE, EQ, GTE, GT }

    public enum CompareWith { COST, LAST_PURCHASE }

    /**
     * Phạm vi: null = tất cả; danh sách = chỉ những id được chọn (không được rỗng).
     * Công thức giá: autoBase (+ autoBaseBookId khi BOOK) ± autoValue → điền giá khi tạo, tính lại khi sửa; autoBase = null
     * và autoUpdate (dữ liệu cũ) = theo giá chung. autoUpdate chỉ có tác dụng với gốc giá chung (trigger theo giá chung).
     */
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
            boolean autoPercent,
            FormulaBase autoBase,
            UUID autoBaseBookId) {

        /** Gốc công thức thực tế: autoBase, hoặc giá chung khi chỉ bật autoUpdate (dữ liệu cũ); null = không có công thức. */
        public FormulaBase effectiveBase() {
            return autoBase != null ? autoBase : autoUpdate ? FormulaBase.BASE_PRICE : null;
        }
    }

    public record PriceBookResponse(UUID id, String name, Instant validFrom, Instant validTo, boolean active,
                                    List<UUID> branchIds, List<UUID> customerGroupIds, List<UUID> sellerIds,
                                    MissingPolicy missingPolicy, boolean autoUpdate, Op autoOp, BigDecimal autoValue,
                                    boolean autoPercent, FormulaBase autoBase, UUID autoBaseBookId, long itemCount,
                                    String createdByName, Instant createdAt) {
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

    /**
     * Bộ lọc dòng (giống sidebar): tìm mã/tên, nhóm hàng, tồn kho; inBookOnly = chỉ hàng đã có trong bảng giá.
     * Giá bán: priceOp + compareWith (cả 2 mới lọc) so sánh giá ở bảng compareBookId (null = giá chung).
     * code / name: ô "Tìm mã hàng" / "Tìm tên hàng" dưới tiêu đề bảng.
     */
    public record RowFilter(String q, List<UUID> categoryIds, String stock, UUID branchId, boolean inBookOnly,
                            PriceCompare priceOp, CompareWith compareWith, UUID compareBookId, String code, String name) {
    }

    /** Sửa giá chung (giá bán của đơn vị tính) từ màn Thiết lập giá. */
    public record BasePriceInput(@NotNull UUID unitId,
                                 @NotNull(message = "Nhập giá") @DecimalMin(value = "0", message = "Giá không được âm") BigDecimal price) {
    }

    public record BasePricesRequest(@NotNull @Size(min = 1, max = 2000) List<@Valid BasePriceInput> items) {
    }

    /**
     * "Đặt giá theo công thức": giá mới = gốc ± value (VNĐ hoặc %) cho mọi dòng thuộc bộ lọc, hoặc chỉ các unitIds
     * (null = tất cả dòng thuộc bộ lọc; dùng cho "chỉ hàng này").
     */
    public record FormulaRequest(@NotNull FormulaBase base, UUID baseBookId, @NotNull Op op,
                                 @NotNull @DecimalMin(value = "0", message = "Giá trị không được âm") BigDecimal value,
                                 boolean percent, boolean onlyExisting, String q, List<UUID> categoryIds, String stock,
                                 UUID branchId, @Size(max = 2000) List<UUID> unitIds, PriceCompare priceOp,
                                 CompareWith compareWith, UUID compareBookId, String code, String name) {

        /** Bộ lọc dòng tương ứng (không giới hạn theo bảng giá). */
        public RowFilter rowFilter() {
            return new RowFilter(q, categoryIds, stock, branchId, false, priceOp, compareWith, compareBookId, code, name);
        }

        /** Công thức lưu trong bảng giá, áp cho mọi hàng (onlyExisting = chỉ hàng đã có trong bảng). */
        public static FormulaRequest of(FormulaBase base, UUID baseBookId, Op op, BigDecimal value, boolean percent,
                                        boolean onlyExisting) {
            return new FormulaRequest(base, baseBookId, op == null ? Op.PLUS : op, value == null ? BigDecimal.ZERO : value,
                    percent, onlyExisting, null, null, null, null, null, null, null, null, null, null);
        }
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
