package com.vaxclinic.common.settings;

import com.vaxclinic.common.error.BusinessException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Thiết lập cửa hàng mà các service cần để áp dụng quy tắc nghiệp vụ. Lưu ở identity-service (bảng app_settings),
 * các service khác đọc qua {@link ShopSettingsClient}. Mỗi nhóm là 1 khóa trong bảng.
 */
public record ShopSettings(Sales sales, CustomerRules customer, BookLock lock) {

    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    /** Thiết lập → Đơn hàng. returnLimitDays null = không giới hạn thời gian trả hàng. */
    public record Sales(boolean allowNegativeStock, boolean blockEditPublishedEInvoice, boolean lockTransactionTime,
                        Integer returnLimitDays) {
        public static final Sales DEFAULT = new Sales(false, true, false, null);
    }

    /**
     * Thiết lập → Khách hàng. requiredFields: phone, email, gender, birthday, address, facebook, group.
     * debtLimit null = không cảnh báo công nợ.
     */
    public record CustomerRules(List<String> requiredFields, BigDecimal debtLimit) {
        public static final CustomerRules DEFAULT = new CustomerRules(List.of(), null);

        public boolean required(String field) {
            return requiredFields != null && requiredFields.contains(field);
        }
    }

    /** Khóa sổ: chứng từ có ngày ≤ ngày khóa của chi nhánh không được tạo / sửa / hủy. */
    public record BookLock(boolean enabled, Map<UUID, LocalDate> branches) {
        public static final BookLock DEFAULT = new BookLock(false, Map.of());

        public LocalDate lockDate(UUID branchId) {
            return enabled && branches != null && branchId != null ? branches.get(branchId) : null;
        }
    }

    public static final ShopSettings DEFAULT = new ShopSettings(Sales.DEFAULT, CustomerRules.DEFAULT, BookLock.DEFAULT);

    public ShopSettings {
        sales = sales == null ? Sales.DEFAULT : sales;
        customer = customer == null ? CustomerRules.DEFAULT : customer;
        lock = lock == null ? BookLock.DEFAULT : lock;
    }

    /** Chặn thao tác trên chứng từ thuộc kỳ đã khóa sổ của chi nhánh. */
    public void checkNotLocked(UUID branchId, Instant documentTime) {
        LocalDate lockDate = lock.lockDate(branchId);
        if (lockDate != null && documentTime != null && !documentTime.atZone(ZONE).toLocalDate().isAfter(lockDate)) {
            throw BusinessException.badRequest("BOOK_LOCKED", "Sổ đã khóa đến ngày "
                    + lockDate.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"))
                    + ": không được tạo, sửa hoặc hủy giao dịch từ ngày này trở về trước");
        }
    }
}
