"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Columns3, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { EMPTY_FILTERS, useProducts } from "@/features/products/product-queries";
import { PageTitle } from "@/features/sales/invoice-list-kit";
import { CommissionEmployeeGrid } from "@/features/hr/commission-employee-grid";
import { CommissionProductGrid } from "@/features/hr/commission-product-grid";
import type { Rate } from "@/features/hr/commission-rate-cell";
import { CommissionSidebar, type CommissionView } from "@/features/hr/commission-sidebar";
import { parseCommissionCsv } from "@/features/hr/commission-csv-import";
import { downloadCsv, useCommissionRules, useCommissionTables, useHrMutation } from "@/features/hr/hr-queries";
import { api } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";

const PAGE_SIZE = 100;
const toolBtn = "flex h-[30px] items-center gap-1 rounded-md border border-[#d9dbe0] bg-white px-2.5 text-[13px] font-semibold hover:border-primary hover:text-primary";
const pagerBtn = "flex size-7 items-center justify-center rounded-md border border-[#d9dbe0] bg-white hover:border-primary disabled:opacity-40";

/** Bảng hoa hồng (ảnh KiotViet 115): mức hoa hồng theo mặt hàng cho từng bảng, nhân viên áp dụng. */
export default function CommissionsPage() {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const [view, setView] = useState<CommissionView>("PRODUCTS");
  const [selected, setSelected] = useState<string[] | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [codeQ, setCodeQ] = useState("");
  const [nameQ, setNameQ] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [checked, setChecked] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: tables = [] } = useCommissionTables();
  const { data: rules = [] } = useCommissionRules();
  useEffect(() => { const timer = setTimeout(() => { setQ((codeQ || nameQ).trim()); setPage(0); }, 300); return () => clearTimeout(timer); }, [codeQ, nameQ]);

  // Mặc định hiển thị mọi bảng hoa hồng đang có cho tới khi người dùng tự chọn
  const selectedIds = selected ?? tables.map((tb) => tb.id);
  const shown = tables.filter((tb) => selectedIds.includes(tb.id));
  const filters = useMemo(() => ({ ...EMPTY_FILTERS, q, categoryIds: categoryId ? [categoryId] : [] }), [q, categoryId]);
  const { data } = useProducts(filters, page, PAGE_SIZE);
  const products = (data?.items ?? []).filter((p) => p.code.toLowerCase().includes(codeQ.trim().toLowerCase())
    && p.name.toLowerCase().includes(nameQ.trim().toLowerCase()));
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const rates = useMemo(() => {
    const m = new Map<string, Rate>();
    rules.forEach((r) => m.set(`${r.tableId}|${r.productId}`, { rateType: r.rateType, value: Number(r.value) }));
    return m;
  }, [rules]);

  const importRules = useHrMutation(async (batches: { tableId: string; items: unknown[] }[]) => {
    for (const b of batches) await api(`/hr/commission-tables/${b.tableId}/rules`, { method: "PUT", body: { items: b.items } });
    return batches.reduce((n, b) => n + b.items.length, 0);
  }, undefined, (n) => toast.success(t("commissions.toastImported", { count: n })));

  const onFile = async (f: File) => {
    const res = parseCommissionCsv(await f.text(), data?.items ?? [], tables);
    if (res.error) { toast.error(t(res.error)); return; }
    if (res.skipped.length) toast.warning(t("commissions.skippedCodes", { codes: res.skipped.slice(0, 5).join(", ") }));
    importRules.mutate(res.batches);
  };

  const exportCsv = () => {
    const fmt = (r: Rate) => (r ? `${r.value}${r.rateType === "PERCENT" ? "%" : ""}` : "");
    downloadCsv("bang-hoa-hong.csv", [
      // Tiêu đề giữ tiếng Việt ở mọi ngôn ngữ: file này import lại được (cột "Mã hàng" + tên bảng hoa hồng)
      ["Mã hàng", "Tên hàng", "Đơn vị tính", "Giá bán chung", "Giá vốn", ...shown.map((tb) => tb.name)],
      ...products.filter((p) => !checked.length || checked.includes(p.id)).map((p) => [p.code, p.name, p.unitName, p.price, p.cost,
        ...shown.map((tb) => fmt(rates.get(`${tb.id}|${p.id}`) ?? null))]),
    ]);
  };

  return (
    <div className="grid grid-cols-[200px_minmax(0,1fr)] gap-x-2.5 gap-y-2.5">
      <PageTitle>{t("commissions.title")}</PageTitle>
      <div className="flex h-8 items-center justify-end gap-2">
        {view === "PRODUCTS" && <>
          <button type="button" className={toolBtn} onClick={() => fileRef.current?.click()} disabled={importRules.isPending}
            title={t("commissions.importHint")}>
            <LogIn className="size-4" /> {t("scheduleImport.button")}</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" aria-label={t("commissions.pickFile")}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          <button type="button" className={toolBtn} onClick={exportCsv}><LogOut className="size-4" /> {tc("actions.export")}</button>
        </>}
        <span className="flex size-[30px] items-center justify-center rounded-md border border-[#d9dbe0] bg-white"><Columns3 className="size-4" /></span>
      </div>
      <CommissionSidebar view={view} onView={setView} selected={selectedIds} onSelected={setSelected}
        categoryId={categoryId} onCategory={(id) => { setCategoryId(id); setPage(0); }} />
      <div className="min-w-0 space-y-2.5">
        {view === "PRODUCTS" ? (
          <>
            <CommissionProductGrid products={products} tables={shown} rates={rates} codeQ={codeQ} nameQ={nameQ}
              onCodeQ={setCodeQ} onNameQ={setNameQ} checked={checked} onChecked={setChecked} />
            {pages > 1 && (
              <div className="flex items-center justify-end gap-2 text-[13px]">
                <span className="text-muted-foreground">{t("commissions.pageInfo", { total: data?.total ?? 0, page: page + 1, pages })}</span>
                <button type="button" className={pagerBtn} aria-label={tc("pager.prev")} disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="size-4" /></button>
                <button type="button" className={pagerBtn} aria-label={tc("pager.next")} disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="size-4" /></button>
              </div>
            )}
          </>
        ) : <CommissionEmployeeGrid tables={shown} allTables={tables} />}
      </div>
    </div>
  );
}
