import type { PartyConfig } from "./party-report";

/** Cấu hình Báo cáo khách hàng / nhân viên / kênh bán hàng (dùng chung PartyReport). */

export const CUSTOMER_REPORT: PartyConfig = {
  page: "bao-cao-khach-hang", title: "Báo cáo khách hàng", noun: "khách hàng", groupBy: "CUSTOMER", productsBy: "CUSTOMER",
  concerns: [["sales", "Bán hàng"], ["products", "Hàng bán theo khách"], ["debt", "Công nợ"], ["profit", "Lợi nhuận"]],
  titles: { sales: "Báo cáo bán hàng theo khách hàng", products: "Báo cáo hàng bán theo khách", debt: "Báo cáo công nợ khách hàng", profit: "Báo cáo lợi nhuận theo khách hàng" },
  chartTitle: "Top 10 khách hàng mua nhiều nhất (đã trừ trả hàng)", firstCol: "Tên khách hàng", codeCol: "Mã khách hàng", filters: ["customer"],
};

export const EMPLOYEE_REPORT: PartyConfig = {
  page: "bao-cao-nhan-vien", title: "Báo cáo nhân viên", noun: "nhân viên", groupBy: "SELLER", productsBy: "SELLER",
  concerns: [["sales", "Bán hàng"], ["profit", "Lợi nhuận"], ["products", "Hàng bán theo nhân viên"]],
  titles: { sales: "Báo cáo bán hàng theo nhân viên", profit: "Báo cáo lợi nhuận theo nhân viên", products: "Báo cáo hàng bán theo nhân viên" },
  chartTitle: "Top 10 người bán nhiều nhất", firstCol: "Người bán", filters: ["seller", "channel"],
  note: "(Người bán = nhân viên bán trên hóa đơn, chưa chọn thì là người tạo)",
};

export const CHANNEL_REPORT: PartyConfig = {
  page: "bao-cao-kenh-ban", title: "Báo cáo kênh bán hàng", noun: "kênh bán", groupBy: "CHANNEL",
  concerns: [["sales", "Bán hàng"], ["profit", "Lợi nhuận"]],
  titles: { sales: "Báo cáo bán hàng theo kênh bán", profit: "Báo cáo lợi nhuận theo kênh bán" },
  chartTitle: "Doanh thu kênh bán hàng", pie: true, firstCol: "Kênh bán", filters: ["seller", "channel"],
  note: "(Ứng dụng chưa có kênh bán online: mọi hóa đơn tính là Bán trực tiếp)",
};
