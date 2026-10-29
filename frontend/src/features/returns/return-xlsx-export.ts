import { api } from "@/lib/api-client";
import type { TFunction } from "@/lib/i18n";
import { deliveryNs } from "@/messages/delivery";
import { salesNs } from "@/messages/sales";
import { buildXlsx } from "@/features/delivery/delivery-xlsx";
import { RETURN_COLUMNS, RETURN_MONEY, returnValue, type ReturnColumn, type ReturnRow } from "./return-list-columns";

type Line = { returnId: string; productCode: string; productName: string; unitName: string; quantity: number; unitPrice: number; amount: number };
type ExportResponse = { items: ReturnRow[]; lines: Line[] };

function query(params: URLSearchParams) {
  const p = new URLSearchParams(params);
  p.delete("page");
  p.delete("size");
  return `/sales-returns/export?${p}`;
}

/** "File tổng quan": mỗi phiếu 1 dòng, Mã trả hàng + các cột đang hiển thị (MỌI phiếu khớp bộ lọc, tối đa 5.000). */
export async function exportReturnOverview(t: TFunction<typeof salesNs.vi>, td: TFunction<typeof deliveryNs.vi>, params: URLSearchParams,
  shown: (c: ReturnColumn) => boolean, branch: (id: string) => string) {
  const data = await api<ExportResponse>(query(params));
  const cols = RETURN_COLUMNS.filter(shown);
  return buildXlsx(t("returns.kv.fileOverview"), [t("returns.kv.cols.code"), ...cols.map((c) => t(`returns.kv.cols.${c}`))],
    data.items.map((r) => [r.code, ...cols.map((c) => returnValue(t, td, r, c, branch))]), [false, ...cols.map((c) => RETURN_MONEY.has(c))]);
}

/** "File chi tiết": mỗi dòng hàng 1 dòng (mã phiếu, thời gian, khách, trạng thái + hàng, SL, giá trả, thành tiền). */
export async function exportReturnDetail(t: TFunction<typeof salesNs.vi>, td: TFunction<typeof deliveryNs.vi>, params: URLSearchParams,
  branch: (id: string) => string) {
  const data = await api<ExportResponse>(query(params));
  const byId = new Map(data.items.map((r) => [r.id, r]));
  const head = (["code", "returnedAt", "invoiceCode", "customer", "status", "productCode", "productName", "unit", "quantity", "price", "amount"] as const)
    .map((k) => t(`returns.kv.cols.${k}`));
  const rows = data.lines.filter((l) => byId.has(l.returnId)).map((l) => {
    const r = byId.get(l.returnId)!;
    return [r.code, returnValue(t, td, r, "returnedAt", branch), r.invoiceCode ?? "", r.customerName ?? "", returnValue(t, td, r, "status", branch),
      l.productCode, l.productName, l.unitName, Number(l.quantity), Number(l.unitPrice), Number(l.amount)];
  });
  return buildXlsx(t("returns.kv.fileDetail"), head, rows, [false, false, false, false, false, false, false, false, false, true, true]);
}
