"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { api } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { saleNs } from "@/messages/sale";
import {
  SALE_TABLE_HEAD, SaleDateRangeCard, SaleFilterCard, SaleFilterInput, SaleTableEmpty, rangeParams, ymdDaysAgo,
} from "./sale-dialog-parts";
import { useDebounced } from "./sale-order-picker-dialog";

type Row = { id: string; code: string; soldAt: string; employeeName: string; customerName: string; total: number };
type Page = { items: Row[]; total: number };
const SIZE = 7;
const FILTERS = [["code", "returnPicker.filters.code"], ["shipmentCode", "returnPicker.filters.shipmentCode"],
  ["lot", "returnPicker.filters.lot"], ["customer", "returnPicker.filters.customer"], ["productCode", "dialogs.filters.productCode"],
  ["productName", "dialogs.filters.productName"]] as const;
type Key = (typeof FILTERS)[number][0];

/** Số trang hiển thị quanh trang hiện tại (tối đa 5, "..." khi còn trang sau). */
function pageWindow(page: number, pages: number) {
  const start = Math.max(0, Math.min(page - 2, pages - 5));
  return Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
}

type Props = { branchId: string; onPick: (invoiceId: string) => void; onQuickReturn: () => void; onClose: () => void };

/**
 * "Chọn hóa đơn trả hàng": hóa đơn đã hoàn thành của điểm tiêm (mặc định 30 ngày), tìm theo mã HĐ / vận đơn / lô / khách /
 * hàng; "Chọn" → tab trả hàng theo hóa đơn; mã hóa đơn mở chi tiết ở tab mới; "Trả nhanh" → trả hàng không theo hóa đơn.
 */
export function SaleReturnPickerDialog({ branchId, onPick, onQuickReturn, onClose }: Props) {
  const t = useT(saleNs);
  const tc = useT(commonNs);
  const [f, setF] = useState<Record<Key, string>>({ code: "", shipmentCode: "", lot: "", customer: "", productCode: "", productName: "" });
  const [range, setRange] = useState({ from: ymdDaysAgo(30), to: "" });
  const [desc, setDesc] = useState(true);
  const [page, setPage] = useState(0);
  const q = useDebounced({ ...f, ...range });
  const { data, isFetching, isError } = useQuery({
    queryKey: ["sale-returnable", branchId, q, desc, page],
    queryFn: () => {
      const p = rangeParams(q.from, q.to);
      FILTERS.forEach(([k]) => q[k].trim() && p.set(k, q[k].trim()));
      p.set("branchId", branchId); p.set("sort", desc ? "desc" : "asc"); p.set("page", String(page)); p.set("size", String(SIZE));
      return api<Page>(`/invoices/returnable?${p}`);
    },
  });
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / SIZE));
  const nav = "grid size-7 place-items-center rounded text-[#6b7280] hover:bg-muted disabled:opacity-40";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-4 p-6 text-[13px] sm:max-w-[998px]">
        <DialogHeader><DialogTitle className="text-[15px] font-bold">{t("menu.return")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-[168px_1fr] items-start gap-7">
          <div className="space-y-5">
            <SaleFilterCard title={tc("actions.search")}>
              {FILTERS.map(([k, label], i) => <SaleFilterInput key={k} autoFocus={i === 0} placeholder={t(label)} value={f[k]}
                onChange={(v) => { setF({ ...f, [k]: v }); setPage(0); }} />)}
            </SaleFilterCard>
            <SaleDateRangeCard from={range.from} to={range.to} onChange={(from, to) => { setRange({ from, to }); setPage(0); }} />
          </div>
          <div className="overflow-hidden rounded-sm border border-[#e5e7eb]">
            <table className="w-full">
              <thead className={SALE_TABLE_HEAD}><tr>
                <th>{t("returnPicker.cols.code")}</th>
                <th><button type="button" className="flex items-center gap-1" onClick={() => { setDesc(!desc); setPage(0); }}>{t("dialogs.time")}
                  <ChevronDown className={`size-4 fill-white ${desc ? "" : "rotate-180"}`} /></button></th>
                <th>{t("returnPicker.cols.employee")}</th><th>{t("dialogs.cols.customer")}</th><th className="text-right">{t("dialogs.cols.total")}</th><th className="w-24" />
              </tr></thead>
              <tbody>
                {!rows.length && <SaleTableEmpty colSpan={6} text={isError ? t("returnPicker.offline") : isFetching ? tc("status.loading") : undefined} />}
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[#eef0f3] [&_td]:h-9 [&_td]:px-2.5">
                    <td><DocCodeLink code={r.code} newTab /></td><td>{formatDateTime(r.soldAt)}</td><td>{r.employeeName}</td>
                    <td>{r.customerName}</td><td className="text-right">{formatMoney(r.total)}</td>
                    <td><Button variant="outline" className="h-7 w-full rounded border-[#9ca3af] text-[13px]"
                      onClick={() => { onPick(r.id); onClose(); }}>{tc("actions.select")}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {total > 0 && (
              <div className="flex items-center justify-end gap-1 p-2.5">
                <button type="button" aria-label={tc("pager.first")} className={nav} disabled={page === 0} onClick={() => setPage(0)}><ChevronsLeft className="size-4" /></button>
                <button type="button" aria-label={tc("pager.prev")} className={nav} disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="size-4" /></button>
                {pageWindow(page, pages).map((p) => (
                  <button key={p} type="button" onClick={() => setPage(p)}
                    className={`grid h-7 min-w-7 place-items-center rounded px-1 ${p === page ? "bg-primary font-semibold text-white" : "hover:bg-muted"}`}>{p + 1}</button>))}
                {pageWindow(page, pages).at(-1)! < pages - 1 && <span className="px-1">...</span>}
                <button type="button" aria-label={tc("pager.next")} className={nav} disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="size-4" /></button>
                <button type="button" aria-label={tc("pager.last")} className={nav} disabled={page + 1 >= pages} onClick={() => setPage(pages - 1)}><ChevronsRight className="size-4" /></button>
                <span className="ml-5">{tc("pager.perPage")} {tc("pager.range", { from: page * SIZE + 1, to: Math.min(total, (page + 1) * SIZE), total })}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <Button className="h-9 rounded-md px-4 font-bold" onClick={() => { onQuickReturn(); onClose(); }}>{t("returnPicker.quickReturn")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
