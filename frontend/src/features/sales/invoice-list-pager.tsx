"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { salesNs } from "@/messages/sales";

/** Chân bảng danh sách kiểu KiotViet: "Hiển thị 15 dòng" + điều hướng trang + "1 - 15 trong N {unit}" (unit: chuỗi đã dịch). */
export function ListPager({ total, page, size, unit, onPage, onSize }: {
  total: number; page: number; size: number; unit: string; onPage: (p: number) => void; onSize?: (s: number) => void;
}) {
  const t = useT(salesNs);
  const tc = useT(commonNs);
  const pages = Math.max(1, Math.ceil(total / size));
  const nav = "inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent";
  const from = total ? page * size + 1 : 0;
  const to = Math.min(total, (page + 1) * size);
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      {onSize && (
        <label className="flex items-center gap-1.5">{tc("pager.perPage")}
          <select className="h-6 rounded border bg-background px-1.5 text-xs" value={size} onChange={(e) => onSize(Number(e.target.value))}>
            {[15, 30, 50, 100].map((n) => <option key={n} value={n}>{t("pager.rows", { count: n })}</option>)}
          </select>
        </label>)}
      <div className="flex items-center gap-0.5">
        <button type="button" className={nav} aria-label={tc("pager.first")} disabled={page === 0} onClick={() => onPage(0)}><ChevronsLeft className="size-3.5" /></button>
        <button type="button" className={nav} aria-label={tc("pager.prev")} disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeft className="size-3.5" /></button>
        <span className="mx-1 inline-flex h-6 min-w-8 items-center justify-center rounded border bg-background px-1.5">{page + 1}</span>
        <button type="button" className={nav} aria-label={tc("pager.next")} disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}><ChevronRight className="size-3.5" /></button>
        <button type="button" className={nav} aria-label={tc("pager.last")} disabled={page + 1 >= pages} onClick={() => onPage(pages - 1)}><ChevronsRight className="size-3.5" /></button>
      </div>
      <span className="font-medium">{t("pager.rangeWithUnit", { from, to, total, unit })}</span>
    </div>
  );
}

type Cell = string | number | null | undefined;

/** Xuất CSV (UTF-8 có BOM để Excel đọc đúng tiếng Việt) từ dữ liệu đang hiển thị. */
export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  const esc = (v: Cell) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
