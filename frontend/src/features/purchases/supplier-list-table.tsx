"use client";

import { Fragment } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ListEmptyState } from "@/components/ui/list-empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LIST_HEADER_ROW } from "./purchase-list-chrome";
import { SupplierDetailPanel } from "./supplier-detail-panel";
import { columnLabel, SUPPLIER_COLUMNS } from "./supplier-list-columns";
import type { SupplierPage } from "./supplier-types";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

type Props = {
  data: SupplierPage | undefined; loading: boolean; columns: string[]; expanded: string | null; onExpand: (id: string | null) => void;
  /** Mã phiếu công nợ của link sâu → panel mở sẵn tab nợ + phiếu. */
  docCode?: string | null;
  selected: string[]; onSelect: (ids: string[]) => void;
};

/**
 * Bảng NCC: ô chọn, các cột đang bật, dòng tổng (Nợ cần trả hiện tại, Tổng mua). Bấm dòng → mở chi tiết; bấm lại → đóng.
 * Dòng đang mở + panel chi tiết có viền xanh 1px bao quanh như KiotViet.
 */
export function SupplierListTable({ data, loading, columns, expanded, onExpand, selected, onSelect, docCode }: Props) {
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  const cols = SUPPLIER_COLUMNS.filter((c) => columns.includes(c.key));
  const span = cols.length + 1;
  const pageIds = data?.items.map((s) => s.id) ?? [];
  const allChecked = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const sums = { debt: data?.sumDebt ?? 0, totalBuy: data?.sumTotalBuy ?? 0 };
  return (
    <div className="overflow-hidden rounded-lg bg-white">
      <Table stickyHeader>
        <TableHeader><TableRow className={LIST_HEADER_ROW}>
          <TableHead className="w-10 pl-3"><Checkbox aria-label={t("suppliers.table.selectAll")} checked={allChecked}
            onCheckedChange={(on) => onSelect(on ? [...new Set([...selected, ...pageIds])] : selected.filter((id) => !pageIds.includes(id)))} /></TableHead>
          {cols.map((c, i) => <TableHead key={c.key} className={cn(c.align === "right" && "text-right", i === cols.length - 1 && "pr-4")}>{columnLabel(c.label, t, tc)}</TableHead>)}
        </TableRow></TableHeader>
        <TableBody>
          <TableRow className="font-bold hover:bg-transparent">
            <TableCell />
            {cols.map((c, i) => <TableCell key={c.key} className={cn("text-right", i === cols.length - 1 && "pr-4")}>{c.sum ? formatMoney(sums[c.sum]) : ""}</TableCell>)}
          </TableRow>
          {loading && !data && <TableRow><TableCell colSpan={span} className="py-8 text-center text-muted-foreground">{tc("status.loading")}</TableCell></TableRow>}
          {data && !data.items.length && (
            <TableRow className="hover:bg-transparent"><TableCell colSpan={span} className="whitespace-normal"><ListEmptyState what={t("suppliers.unit")} /></TableCell></TableRow>
          )}
          {data?.items.map((s) => {
            const open = expanded === s.id;
            const edge = open ? "border-t border-primary first:border-l last:border-r" : "";
            return (
              <Fragment key={s.id}>
                <TableRow aria-expanded={open} onClick={() => onExpand(open ? null : s.id)}
                  className={cn("cursor-pointer", open && "bg-primary-tint font-semibold hover:bg-primary-tint", !s.active && "text-muted-foreground")}>
                  <TableCell className={cn("pl-3", edge)} onClick={(e) => e.stopPropagation()}>
                    <Checkbox aria-label={t("suppliers.table.selectRow", { code: s.code })} checked={selected.includes(s.id)}
                      onCheckedChange={(on) => onSelect(on ? [...selected, s.id] : selected.filter((id) => id !== s.id))} /></TableCell>
                  {cols.map((c, i) => (
                    <TableCell key={c.key} className={cn(edge, c.align === "right" && "text-right", c.key === "name" && "max-w-[320px] whitespace-normal",
                      i === cols.length - 1 && "pr-4")}>{c.value(s, tc)}</TableCell>
                  ))}
                </TableRow>
                {open && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={span} className="p-0 whitespace-normal"><SupplierDetailPanel id={s.id} docCode={docCode} onClose={() => onExpand(null)} /></TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
