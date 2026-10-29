import { buildXlsx } from "@/features/delivery/delivery-xlsx";
import { api } from "@/lib/api-client";
import type { TFunction } from "@/lib/i18n";
import { ordersNs } from "@/messages/orders";
import { ORDER_COLUMNS, ORDER_MONEY, orderValue, type OrderColumn } from "./order-list-columns";
import type { OrderListItem } from "./order-types";

type Line = { orderId: string; productCode: string; productName: string; unitName: string; quantity: number; unitPrice: number;
  discount: number; amount: number };
type ExportResponse = { items: OrderListItem[]; lines: Line[] };
type OT = TFunction<typeof ordersNs.vi>;

const query = (params: URLSearchParams) => {
  const p = new URLSearchParams(params);
  p.delete("page");
  p.delete("size");
  return `/orders/export?${p}`;
};

/** File tổng quan: mỗi đơn 1 dòng, Mã đặt hàng + các cột đang hiện (mọi đơn khớp bộ lọc, tối đa 5.000). */
export async function exportOrderOverview(t: OT, params: URLSearchParams, shown: (c: OrderColumn) => boolean, channel: (c: string) => string) {
  const data = await api<ExportResponse>(query(params));
  const cols = ORDER_COLUMNS.filter(shown);
  return buildXlsx(t("kv.fileOverview"), [t("cols.code"), ...cols.map((c) => t(`kv.cols.${c}`))],
    data.items.map((o) => [o.code, ...cols.map((c) => orderValue(t, o, c, channel))]), [false, ...cols.map((c) => ORDER_MONEY.has(c))]);
}

/** File chi tiết: mỗi dòng hàng 1 dòng (mã đơn, thời gian, khách, trạng thái + hàng, SL, đơn giá, giảm giá, thành tiền). */
export async function exportOrderDetail(t: OT, params: URLSearchParams, channel: (c: string) => string) {
  const data = await api<ExportResponse>(query(params));
  const byId = new Map(data.items.map((o) => [o.id, o]));
  const head = [t("cols.code"), t("cols.time"), t("cols.customer"), t("cols.status"), t("cols.productCode"), t("cols.productName"),
    t("cols.unit"), t("cols.quantity"), t("cols.unitPrice"), t("cols.discount"), t("cols.amount")];
  const rows = data.lines.filter((l) => byId.has(l.orderId)).map((l) => {
    const o = byId.get(l.orderId)!;
    return [o.code, orderValue(t, o, "orderedAt", channel), o.customerName, orderValue(t, o, "status", channel), l.productCode, l.productName,
      l.unitName, Number(l.quantity), Number(l.unitPrice), Number(l.discount), Number(l.amount)];
  });
  return buildXlsx(t("kv.fileDetail"), head, rows, [false, false, false, false, false, false, false, false, true, true, true]);
}
