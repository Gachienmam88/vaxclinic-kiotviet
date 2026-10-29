"use client";

import { Fragment } from "react";
import { useDeepLinkExpanded, type DeepLink } from "@/components/ui/deep-link-route";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { LIST_HEAD_ROW } from "@/features/sales/invoice-list-kit";
import { formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { deliveryNs } from "@/messages/delivery";
import type { ShipmentList } from "./delivery-types";
import { DEFAULT_SHIPMENT_COLUMNS, MONEY_COLUMNS, renderCell, SHIPMENT_COLUMNS, type ShipmentColumn } from "./shipment-list-columns";
import { ShipmentDetailPanel } from "./shipment-detail-panel";

const NO_LINK: DeepLink = { code: null, id: null };

/**
 * Bảng vận đơn (KiotViet): ô chọn, các cột đang hiển thị, dòng tổng (thu hộ / phí) dưới tiêu đề, bấm dòng mở chi tiết ngay dưới.
 * compact: bảng con trong chi tiết đối tác (cột mặc định, không chọn).
 */
export function ShipmentTable({ data, selected, onSelect, onWiden, compact, link = NO_LINK, shown }: {
  data: ShipmentList | undefined; selected?: string[]; onSelect?: (ids: string[]) => void;
  onWiden?: () => void; compact?: boolean; link?: DeepLink; shown?: (c: ShipmentColumn) => boolean;
}) {
  const t = useT(deliveryNs);
  const items = data?.items ?? [];
  const cols = SHIPMENT_COLUMNS.filter((c) => (shown ? shown(c) : DEFAULT_SHIPMENT_COLUMNS.includes(c)));
  const span = cols.length + 1;
  const { open: expanded, setOpen: setExpanded, toggle: toggleRow } = useDeepLinkExpanded(data?.items, link, (s) => [s.code]);
  const pick = !!onSelect && !!selected;
  const all = pick && items.length > 0 && items.every((s) => selected.includes(s.id));
  const toggle = (id: string, on: boolean) => onSelect?.(on ? [...(selected ?? []), id] : (selected ?? []).filter((x) => x !== id));
  const sum = (c: ShipmentColumn) => (c === "cod" ? data?.sumCod : c === "fee" ? data?.sumFee : undefined);

  return (
    <div className={cn("overflow-x-auto rounded-lg bg-background", compact && "border")}>
      <Table stickyHeader>
        <TableHeader><TableRow className={LIST_HEAD_ROW}>
          <TableHead className="w-10 pl-4">{pick && <input type="checkbox" aria-label={t("table.selectAll")} className="accent-primary" checked={all}
            onChange={(e) => onSelect?.(e.target.checked ? items.map((s) => s.id) : [])} />}</TableHead>
          {cols.map((c) => <TableHead key={c} className={cn(MONEY_COLUMNS.has(c) && "text-right")}>{t(`kv.cols.${c}`)}</TableHead>)}
        </TableRow></TableHeader>
        <TableBody>
          {!!items.length && <TableRow className="h-9 font-bold hover:bg-transparent">
            <TableCell />{cols.map((c) => <TableCell key={c} className="text-right">{sum(c) != null ? formatMoney(sum(c)!) : ""}</TableCell>)}
          </TableRow>}
          {data && !items.length && <ListEmptyRow cols={span} what={t("kv.list.emptyWhat")} onWiden={onWiden} compact={compact} />}
          {items.map((s) => (
            <Fragment key={s.id}>
              <TableRow className={cn("cursor-pointer align-top", expanded === s.id && "bg-primary-tint hover:bg-primary-tint")} onClick={() => toggleRow(s.id)}>
                <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                  {pick && <input type="checkbox" aria-label={t("table.selectRow", { code: s.code })} className="accent-primary" checked={selected.includes(s.id)}
                    onChange={(e) => toggle(s.id, e.target.checked)} />}</TableCell>
                {cols.map((c) => (
                  <TableCell key={c} className={cn(MONEY_COLUMNS.has(c) && "text-right", (c === "customer" || c === "address") && "max-w-[160px] whitespace-normal")}
                    title={c === "waybill" ? s.code : undefined} onClick={c === "invoice" || c === "customerCode" ? (e) => e.stopPropagation() : undefined}>
                    {renderCell(t, s, c)}</TableCell>))}
              </TableRow>
              {expanded === s.id && <TableRow className="hover:bg-transparent"><TableCell colSpan={span} className="p-0 whitespace-normal">
                <ShipmentDetailPanel id={s.id} onClose={() => setExpanded(null)} /></TableCell></TableRow>}
            </Fragment>))}
        </TableBody>
      </Table>
    </div>
  );
}
