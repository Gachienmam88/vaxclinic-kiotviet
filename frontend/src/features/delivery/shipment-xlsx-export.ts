import { api } from "@/lib/api-client";
import type { TFunction } from "@/lib/i18n";
import { deliveryNs } from "@/messages/delivery";
import type { ShipmentItem, ShipmentList } from "./delivery-types";
import { downloadXlsx } from "./delivery-xlsx";
import { cellValue, MONEY_COLUMNS, SHIPMENT_COLUMNS, type ShipmentColumn } from "./shipment-list-columns";

/** Xuất file Vận đơn: MỌI vận đơn khớp bộ lọc hiện tại (lấy từng trang 200), đúng các cột đang hiển thị. */
export async function exportShipmentsXlsx(t: TFunction<typeof deliveryNs.vi>, params: URLSearchParams, shown: (c: ShipmentColumn) => boolean) {
  const items: ShipmentItem[] = [];
  for (let page = 0; ; page++) {
    const p = new URLSearchParams(params);
    p.set("page", String(page));
    p.set("size", "200");
    const r = await api<ShipmentList>(`/shipments?${p}`);
    items.push(...r.items);
    if (items.length >= r.total || !r.items.length) break;
  }
  const cols = SHIPMENT_COLUMNS.filter(shown);
  await downloadXlsx(t("kv.list.file"), cols.map((c) => t(`kv.cols.${c}`)), items.map((s) => cols.map((c) => cellValue(t, s, c))),
    cols.map((c) => MONEY_COLUMNS.has(c)));
}
