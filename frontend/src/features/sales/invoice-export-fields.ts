import { formatDate, formatDateTime } from "@/lib/format";
import { einvoiceState, EINVOICE_STATE_OPTIONS } from "./invoice-einvoice-state";
import { stateLabel } from "./invoice-filter-model";
import type { EInvoiceRecord } from "@/features/integrations/integration-queries";
import type { InvoiceListItem } from "./sales-types";

/**
 * Cột của file "Xuất file chi tiết" (mỗi dòng hàng 1 dòng). Tiêu đề cột giữ tiếng Việt ở mọi ngôn ngữ như KiotViet / kế toán.
 * Chỉ gồm cột hệ thống có dữ liệu — bỏ: Trạng thái / Ghi chú CSDL về dược, Địa chỉ lấy hàng, Mã đối soát, Bác sĩ,
 * Giá trị VAT, VAT, Có dùng VAT, Trạng thái Áp dụng giảm thuế, Giá trị giảm thuế.
 */
export type Cell = string | number | null | undefined;

export type ExportExtra = {
  invoiceId: string; cash: number; card: number; transfer: number; ewallet: number; receiverName: string | null;
  receiverPhone: string | null; receiverAddress: string | null; receiverArea: string | null; receiverProvinceCode: string | null;
  receiverWardCode: string | null; serviceType: string | null; weightGram: number | null; lengthCm: number | null;
  widthCm: number | null; heightCm: number | null; shipmentNote: string | null; statusNote: string | null;
};
export type ExportLine = {
  invoiceId: string; lineNo: number; productId: string; productCode: string; productName: string; unitName: string;
  quantity: number; unitPrice: number; discount: number; price: number; amount: number; lots: string | null; note: string | null;
  taxCode: string | null;
};
export type ExportResponse = { items: InvoiceListItem[]; extras: ExportExtra[]; lines: ExportLine[] };

/** Tra cứu ngoài sales-service: HĐĐT, chi nhánh, MST cửa hàng, nhóm hàng / mã vạch / HSD lô, tên phường xã. */
export type ExportLookups = {
  einv: Map<string, EInvoiceRecord>; branches: Map<string, string>; sellerTaxCode: string | null;
  category: Map<string, string>; barcode: Map<string, string>; expiry: Map<string, string>; wardName: Map<string, string>;
};

export type DetailRow = { inv: InvoiceListItem; line: ExportLine; extra: ExportExtra | undefined; lk: ExportLookups };

export const SHIPMENT_STATUS_VI: Record<string, string> = {
  PENDING: "Chờ xử lý", PICKING: "Đang lấy hàng", DELIVERING: "Đang giao hàng", DELIVERED: "Giao thành công",
  RETURNING: "Chuyển hoàn", RETURNED: "Đã chuyển hoàn", CANCELLED: "Đã hủy",
};
const SERVICE_VI: Record<string, string> = { STANDARD: "Giao thường", EXPRESS: "Giao nhanh" };

/** Giá trị cột hóa đơn dùng chung cho file tổng quan và chi tiết. */
export function invoiceValue(i: InvoiceListItem, key: string, lk: Pick<ExportLookups, "einv" | "branches" | "sellerTaxCode">): Cell {
  const rec = lk.einv.get(i.id);
  const st = einvoiceState(rec);
  const issued = st === "PUBLISHED" || st === "ACCEPTED";
  switch (key) {
    case "code": return i.code;
    case "soldAt": case "createdAt": case "updatedAt": case "deliveryTime": return formatDateTime(i[key]) || null;
    case "customerBirthday": return formatDate(i.customerBirthday) || null;
    case "state": return stateLabel(i.state);
    case "einvoice": return st === "NONE" ? null : EINVOICE_STATE_OPTIONS.find(([v]) => v === st)?.[1];
    case "einvoiceNature": return issued ? "Hóa đơn gốc" : null;
    case "einvoiceNo": return issued ? rec?.inv_no : null;
    case "einvoiceSeries": return issued ? rec?.inv_series : null;
    case "shipmentStatus": return i.shipmentStatus ? SHIPMENT_STATUS_VI[i.shipmentStatus] ?? i.shipmentStatus : null;
    case "branch": return lk.branches.get(i.branchId);
    case "sellerTaxCode": return lk.sellerTaxCode;
    default: return (i as unknown as Record<string, Cell>)[key];
  }
}

type Field = { key: string; label: string; value: (r: DetailRow) => Cell };
const inv = (key: string, label: string): Field => ({ key, label, value: (r) => invoiceValue(r.inv, key, r.lk) });
const pct = (r: DetailRow) => (r.line.unitPrice ? Math.round((r.line.discount / r.line.unitPrice) * 10000) / 100 : 0);
const vat = (code: string | null) => (code ? (/(\d+)/.exec(code)?.[1] ? `${/(\d+)/.exec(code)![1]}%` : code) : null);
const lots = (r: DetailRow) => r.line.lots?.split(", ") ?? [];

export const DETAIL_GROUPS: { key: string; fields: Field[] }[] = [
  { key: "invoice", fields: [
    inv("branch", "Chi nhánh"), inv("code", "Mã hóa đơn"), inv("soldAt", "Thời gian"), inv("createdAt", "Thời gian tạo"),
    inv("updatedAt", "Ngày cập nhật"), inv("sellerName", "Người bán"), inv("salesChannelName", "Kênh bán"),
    inv("createdByName", "Người tạo"), inv("note", "Ghi chú"), inv("subtotal", "Tổng tiền hàng"), inv("discount", "Giảm giá hóa đơn"),
    inv("total", "Khách cần trả"), inv("state", "Trạng thái"), inv("sellerTaxCode", "Mã số thuế người bán"),
    inv("einvoice", "Trạng thái HĐĐT"), inv("einvoiceNo", "Số hóa đơn"), inv("einvoiceSeries", "Ký hiệu hóa đơn"),
    inv("einvoiceNature", "Tính chất hóa đơn")] },
  { key: "payment", fields: [
    inv("paid", "Khách đã trả"), { key: "cash", label: "Tiền mặt", value: (r) => r.extra?.cash },
    { key: "card", label: "Thẻ", value: (r) => r.extra?.card }, { key: "ewallet", label: "Ví", value: (r) => r.extra?.ewallet },
    { key: "transfer", label: "Chuyển khoản", value: (r) => r.extra?.transfer }] },
  { key: "customer", fields: [
    inv("customerCode", "Mã khách hàng"), inv("customerName", "Tên khách hàng"), inv("customerEmail", "Email"),
    inv("customerPhone", "Điện thoại"), inv("customerAddress", "Địa chỉ (Khách hàng)"), inv("customerProvince", "Khu vực (Khách hàng)"),
    inv("customerWard", "Phường/Xã (Khách hàng)"), inv("customerBirthday", "Ngày sinh")] },
  { key: "product", fields: [
    { key: "priceBook", label: "Bảng giá", value: (r) => r.inv.priceBookName ?? "Bảng giá chung" },
    { key: "category", label: "Nhóm hàng", value: (r) => r.lk.category.get(r.line.productId) },
    { key: "productCode", label: "Mã hàng", value: (r) => r.line.productCode },
    { key: "barcode", label: "Mã vạch", value: (r) => r.lk.barcode.get(r.line.productCode.toUpperCase()) },
    { key: "productName", label: "Tên hàng", value: (r) => r.line.productName }, { key: "unit", label: "ĐVT", value: (r) => r.line.unitName },
    { key: "lot", label: "Lô", value: (r) => r.line.lots },
    { key: "expiry", label: "Hạn sử dụng", value: (r) => lots(r).map((l) => r.lk.expiry.get(`${r.line.productId}|${l}`)).filter(Boolean).join(", ") || null },
    { key: "lineNote", label: "Ghi chú hàng hóa", value: (r) => r.line.note }, { key: "quantity", label: "Số lượng", value: (r) => r.line.quantity },
    { key: "unitPrice", label: "Đơn giá", value: (r) => r.line.unitPrice }, { key: "discountPct", label: "Giảm giá %", value: pct },
    { key: "lineDiscount", label: "Giảm giá", value: (r) => r.line.discount }, { key: "price", label: "Giá bán", value: (r) => r.line.price },
    { key: "amount", label: "Thành tiền", value: (r) => r.line.amount }, { key: "vat", label: "VAT(%)", value: (r) => vat(r.line.taxCode) }] },
  { key: "delivery", fields: [
    inv("shipmentCode", "Mã vận đơn"), inv("partnerFee", "Phí trả ĐTGH"), inv("deliveryPartnerName", "Đối tác giao hàng"),
    { key: "receiverName", label: "Người nhận", value: (r) => r.extra?.receiverName },
    { key: "receiverPhone", label: "Điện thoại (Người nhận)", value: (r) => r.extra?.receiverPhone },
    { key: "receiverAddress", label: "Địa chỉ (Người nhận)", value: (r) => r.extra?.receiverAddress },
    { key: "receiverArea", label: "Khu vực (Người nhận)", value: (r) => r.extra?.receiverArea },
    { key: "receiverWard", label: "Phường/Xã (Người nhận)", value: (r) => r.lk.wardName.get(r.extra?.receiverWardCode ?? "") },
    { key: "service", label: "Dịch vụ", value: (r) => (r.extra?.serviceType ? SERVICE_VI[r.extra.serviceType] : null) },
    { key: "weight", label: "Trọng lượng (gram)", value: (r) => r.extra?.weightGram }, { key: "length", label: "Dài", value: (r) => r.extra?.lengthCm },
    { key: "width", label: "Rộng", value: (r) => r.extra?.widthCm }, { key: "height", label: "Cao", value: (r) => r.extra?.heightCm },
    { key: "statusNote", label: "Ghi chú trạng thái giao hàng", value: (r) => r.extra?.statusNote },
    { key: "shipmentNote", label: "Ghi chú GH", value: (r) => r.extra?.shipmentNote }, inv("cod", "Còn cần thu (COD)"),
    inv("deliveryTime", "Thời gian giao hàng"), inv("shipmentStatus", "Trạng thái giao hàng")] },
  { key: "other", fields: [inv("orderCode", "Mã đặt hàng"), inv("returnCodes", "Mã trả hàng")] },
];

export const ALL_DETAIL_KEYS = DETAIL_GROUPS.flatMap((g) => g.fields.map((f) => f.key));
