"use client";

import { Fragment } from "react";
import { Star } from "lucide-react";
import { useDeepLinkExpanded, type DeepLink } from "@/components/ui/deep-link-route";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranches } from "@/features/settings/settings-queries";
import { LIST_HEAD_ROW } from "@/features/sales/invoice-list-kit";
import { formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { deliveryNs } from "@/messages/delivery";
import { salesNs } from "@/messages/sales";
import { SalesReturnDetailPanel } from "@/app/(admin)/returns/sales-return-detail-panel";
import { RETURN_COLUMNS, RETURN_MONEY, returnCell, type ReturnColumn, type ReturnRow } from "./return-list-columns";

export type ReturnPage = { items: ReturnRow[]; total: number; sumTotal: number };

/**
 * Bảng Trả hàng (KiotViet): ô chọn, ☆ đánh dấu, Mã trả hàng + các cột đang hiện, dòng tổng "Cần trả khách", bấm dòng mở chi tiết.
 * Trống → "Không tìm thấy kết quả … trong tháng này. Nhấn vào đây để tiếp tục tìm kiếm" (onWiden = toàn thời gian).
 */
export function ReturnListTable({ data, shown, link, selected, onSelect, fav, onWiden }: {
  data: ReturnPage | undefined; shown: (c: ReturnColumn) => boolean; link: DeepLink; selected: string[]; onSelect: (ids: string[]) => void;
  fav: { isFav: (id: string) => boolean; toggle: (id: string) => void }; onWiden?: () => void;
}) {
  const t = useT(salesNs);
  const td = useT(deliveryNs);
  const { data: branches = [] } = useBranches();
  const branch = (id: string) => branches.find((b) => b.id === id)?.name ?? "";
  const cols = RETURN_COLUMNS.filter(shown);
  const span = cols.length + 3;
  const items = data?.items ?? [];
  const { open, setOpen, toggle } = useDeepLinkExpanded(data?.items, link, (r) => [r.code]);
  const all = items.length > 0 && items.every((r) => selected.includes(r.id));
  return (
    <div className="overflow-x-auto rounded-lg bg-background">
      <Table stickyHeader>
        <TableHeader><TableRow className={LIST_HEAD_ROW}>
          <TableHead className="w-9 pl-4"><input type="checkbox" className="accent-primary" aria-label={t("returns.kv.cols.code")} checked={all}
            onChange={(e) => onSelect(e.target.checked ? items.map((r) => r.id) : [])} /></TableHead>
          <TableHead className="w-8"><Star className="size-4 text-muted-foreground" aria-label={t("returns.kv.favourite")} /></TableHead>
          <TableHead>{t("returns.kv.cols.code")}</TableHead>
          {cols.map((c) => <TableHead key={c} className={cn(RETURN_MONEY.has(c) && "text-right")}>{t(`returns.kv.cols.${c}`)}</TableHead>)}
        </TableRow></TableHeader>
        <TableBody>
          {!!items.length && <TableRow className="h-9 font-bold hover:bg-transparent"><TableCell colSpan={3} />
            {cols.map((c) => <TableCell key={c} className="text-right">{c === "total" ? formatMoney(data?.sumTotal ?? 0) : ""}</TableCell>)}</TableRow>}
          {data && !items.length && <ListEmptyRow cols={span} what={t("returns.kv.emptyWhat")} onWiden={onWiden} />}
          {items.map((r) => (
            <Fragment key={r.id}>
              <TableRow className={cn("cursor-pointer", open === r.id && "bg-primary-tint hover:bg-primary-tint")} onClick={() => toggle(r.id)}>
                <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="accent-primary" aria-label={r.code}
                  checked={selected.includes(r.id)} onChange={(e) => onSelect(e.target.checked ? [...selected, r.id] : selected.filter((x) => x !== r.id))} /></TableCell>
                <TableCell onClick={(e) => { e.stopPropagation(); fav.toggle(r.id); }}>
                  <Star className={cn("size-4", fav.isFav(r.id) ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} aria-label={t("returns.kv.favourite")} /></TableCell>
                <TableCell>{r.code}</TableCell>
                {cols.map((c) => <TableCell key={c} className={cn(RETURN_MONEY.has(c) && "text-right", (c === "customer" || c === "note") && "max-w-[180px] whitespace-normal")}
                  onClick={["invoiceCode", "saleShipmentCode", "customerCode"].includes(c) ? (e) => e.stopPropagation() : undefined}>
                  {returnCell(t, td, r, c, branch)}</TableCell>)}
              </TableRow>
              {open === r.id && <TableRow className="hover:bg-transparent"><TableCell colSpan={span} className="p-0 whitespace-normal">
                <SalesReturnDetailPanel id={r.id} onClose={() => setOpen(null)} /></TableCell></TableRow>}
            </Fragment>))}
        </TableBody>
      </Table>
    </div>
  );
}
