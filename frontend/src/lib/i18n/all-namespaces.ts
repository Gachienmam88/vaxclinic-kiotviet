/**
 * Mọi namespace message (tên file trong src/messages/<locale>/). Khung quản lý và màn bán hàng gửi sẵn TẤT CẢ cho
 * ngôn ngữ đang chọn (~40KB gzip/ngôn ngữ): trang nào dùng component của khu vực khác (pager, bộ lọc, hộp thoại…)
 * cũng không nháy tiếng Việt / lệch hydrate. Thêm namespace mới → thêm tên vào đây (test i18n-keys kiểm tra).
 */
export const ALL_NAMESPACES = [
  "accounting", "auth", "cashbook", "common", "customers", "dashboard", "delivery", "errors", "hr", "inventory", "nav",
  "notifications", "orders", "print", "products", "purchases", "reports", "sale", "sales", "settings", "store-profile",
] as const;
