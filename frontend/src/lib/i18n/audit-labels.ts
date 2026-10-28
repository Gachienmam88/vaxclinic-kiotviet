import type { Locale } from "./locales";

/**
 * Nhật ký thao tác lưu "chức năng" + "hành động" bằng tiếng Việt (dữ liệu từ server, không có mã).
 * Bảng dịch theo đúng chuỗi tiếng Việt; chuỗi chưa có trong bảng → hiện nguyên văn (thêm vào đây khi backend có chuỗi mới).
 */
type Row = [vi: string, en: string, ja: string, zh: string];

const FEATURES: Row[] = [
  ["Hàng hóa", "Products", "商品", "商品"], ["Hóa đơn", "Invoices", "売上伝票", "销售单"],
  ["Hồ sơ cửa hàng", "Store profile", "店舗プロフィール", "店铺资料"], ["Khách hàng", "Customers", "顧客", "客户"],
  ["Kênh bán", "Sales channels", "販売チャネル", "销售渠道"], ["Người dùng", "Users", "ユーザー", "用户"],
  ["Nhà cung cấp", "Suppliers", "仕入先", "供应商"], ["Nhân viên", "Employees", "従業員", "员工"],
  ["Nhóm khách hàng", "Customer groups", "顧客グループ", "客户分组"], ["Nhập hàng", "Goods receipts", "入荷", "进货"],
  ["Phiếu chi", "Payment vouchers", "出金伝票", "付款单"], ["Phiếu thu", "Receipt vouchers", "入金伝票", "收款单"],
  ["Thiết lập cửa hàng", "Store settings", "店舗設定", "店铺设置"], ["Thiết lập giá", "Price books", "価格設定", "价格设置"],
  ["Thuế & Kế toán", "Tax & accounting", "税務・会計", "税务与会计"], ["Thông báo nội bộ", "Announcements", "社内のお知らせ", "内部公告"],
  ["Trả hàng", "Returns", "返品", "退货"], ["Trả hàng nhập", "Purchase returns", "仕入返品", "进货退货"],
  ["Tài khoản", "Account", "アカウント", "账户"], ["Vận đơn", "Shipments", "配送伝票", "运单"],
  ["Xuất hủy", "Write-offs", "廃棄", "报损"], ["Đặt hàng", "Orders", "受注", "订货"],
  ["Đối tác giao hàng", "Delivery partners", "配送業者", "配送伙伴"], ["Bảng lương", "Payroll", "給与表", "工资表"],
  ["Chấm công", "Timekeeping", "勤怠", "考勤"], ["Duyệt chấm công", "Timesheet approval", "勤怠承認", "考勤审批"],
  ["Xếp lịch", "Scheduling", "シフト作成", "排班"], ["Xóa lịch", "Schedule removal", "シフト削除", "删除排班"],
  ["Import", "Import", "インポート", "导入"], ["Kiểm kho", "Stock takes", "棚卸", "盘点"],
  ["Xuất dùng nội bộ", "Internal use", "社内使用出庫", "内部领用"],
];

const ACTIONS: Row[] = [
  ["Tạo", "created", "作成", "创建"], ["Thêm mới", "added", "追加", "新增"], ["Sửa", "edited", "編集", "修改"],
  ["Xóa", "deleted", "削除", "删除"], ["Hủy", "cancelled", "取消", "取消"], ["Hoàn thành", "completed", "完了", "完成"],
  ["Lưu tạm", "saved as draft", "一時保存", "暂存"], ["Xác nhận", "confirmed", "確定", "确认"],
  ["Cập nhật trạng thái", "updated status of", "ステータス更新", "更新状态"], ["Chiết khấu", "discounted", "値引き", "折扣"],
  ["Điều chỉnh nợ", "adjusted debt of", "残高調整", "调整欠款"], ["Thu nợ", "collected debt for", "入金消込", "收回欠款"],
  ["Thanh toán", "paid", "支払い", "付款"], ["Trả hàng", "returned", "返品", "退货"], ["Nhập kho", "received stock for", "入庫", "入库"],
  ["Nhập file", "imported file for", "ファイル取込", "导入文件"], ["Import", "imported", "インポート", "导入"],
  ["Ngừng kinh doanh", "discontinued", "販売停止", "停售"], ["Sửa giá", "changed price of", "価格変更", "改价"],
  ["Sửa thuế", "changed tax of", "税変更", "修改税"], ["Tạo vai trò", "created role in", "ロール作成", "创建角色"],
  ["Sửa vai trò", "edited role in", "ロール編集", "修改角色"], ["Xóa vai trò", "deleted role in", "ロール削除", "删除角色"],
  ["Áp dụng công thức", "applied formula to", "計算式適用", "应用公式"], ["Đối soát", "reconciled", "照合", "对账"],
  ["Hủy đối soát", "cancelled reconciliation of", "照合取消", "取消对账"], ["Đồng ý", "accepted", "同意", "同意"],
  ["Đặt lại xác thực 2 lớp", "reset 2FA of", "二段階認証リセット", "重置双重验证"], ["Hủy thanh toán", "cancelled payment of", "支払い取消", "取消付款"],
];

const index = (rows: Row[]) => new Map(rows.map((r) => [r[0], r]));
const FEATURE_MAP = index(FEATURES);
const ACTION_MAP = index(ACTIONS);
const COL: Record<Locale, number> = { vi: 0, en: 1, ja: 2, zh: 3 };

function pick(map: Map<string, Row>, value: string, locale: Locale) {
  const row = map.get(value.trim());
  return row ? row[COL[locale] ?? 0] : value;
}

/** Tên chức năng trong nhật ký theo ngôn ngữ (không có trong bảng → nguyên văn). */
export const auditFeatureLabel = (value: string, locale: Locale) => pick(FEATURE_MAP, value, locale);
/** Hành động trong nhật ký theo ngôn ngữ (en dạng động từ quá khứ "created"; không có → nguyên văn). */
export const auditActionLabel = (value: string, locale: Locale) => pick(ACTION_MAP, value, locale);
