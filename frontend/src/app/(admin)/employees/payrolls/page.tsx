"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Columns3, LogOut, Plus } from "lucide-react";
import { DeepLinkRoute, sameCode, type DeepLink } from "@/components/ui/deep-link-route";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { CheckOption, FilterSection, FilterSidebar, LIST_HEAD_ROW, ListSearch, PageTitle } from "@/features/sales/invoice-list-kit";
import { dmy, downloadCsv, usePayrolls } from "@/features/hr/hr-queries";
import { PAYROLL_STATUS, type PayrollStatus } from "@/features/hr/hr-types";
import { PayrollCreateDialog } from "@/features/hr/payroll-create-dialog";
import { statusLabel } from "@/features/hr/payroll-ui-parts";
import { formatMoney } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";

const PAGE_SIZE = 15;
const pagerBtn = "flex size-7 items-center justify-center rounded-md border border-[#d9dbe0] bg-white hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40";
const toolBtn = "flex h-[30px] items-center gap-1 rounded-md border bg-white px-2.5 text-[13px] font-semibold";

/** Bảng lương (ảnh KiotViet 114): lọc kỳ hạn trả + trạng thái, dòng tổng, danh sách bảng lương. ?code=BL… → mở thẳng trang chi tiết. */
function PayrollsPage({ link }: { link: DeepLink }) {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const router = useRouter();
  const [search, setSearch] = useState(link.code ?? "");
  const [q, setQ] = useState(link.code ?? "");
  const [statuses, setStatuses] = useState<PayrollStatus[]>(link.code ? PAYROLL_STATUS.map(([s]) => s) : ["DRAFT", "TEMP", "LOCKED"]);
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  useEffect(() => { const timer = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(timer); }, [search]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
    if (q) p.set("q", q);
    // Bỏ chọn hết trạng thái → không có bảng lương nào (giống KiotViet), gửi trạng thái không tồn tại
    (statuses.length ? statuses : ["NONE"]).forEach((s) => p.append("statuses", s));
    return p;
  }, [q, statuses, page]);
  const { data } = usePayrolls(params);
  const linkedId = link.code ? data?.items.find((p) => sameCode(p.code, link.code))?.id : undefined;
  useEffect(() => { if (linkedId) router.replace(`/employees/payrolls/${linkedId}`); }, [linkedId, router]);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const toggle = (s: PayrollStatus, on: boolean) => { setStatuses(on ? [...statuses, s] : statuses.filter((x) => x !== s)); setPage(0); };

  const exportCsv = () => downloadCsv("bang-luong.csv", [
    [tc("fields.code"), tc("fields.name"), t("payrollCreate.payCycle"), t("payrollCreate.workPeriod"), t("payslipCols.total"),
      t("payrolls.paidToEmployees"), t("payslipCols.remaining"), tc("fields.status")],
    ...(data?.items ?? []).filter((p) => !checked.length || checked.includes(p.id)).map((p) => [p.code, p.name, t("payrollCreate.monthly"),
      `${dmy(p.periodStart)} - ${dmy(p.periodEnd)}`, p.total, p.paid, p.remaining, statusLabel(t, p.status)]),
  ]);

  return (
    <div className="grid grid-cols-[200px_minmax(0,1fr)] gap-x-2.5 gap-y-2.5">
      <PageTitle>{t("payrolls.title")}</PageTitle>
      <div className="flex h-8 items-center gap-2">
        <ListSearch value={search} onChange={setSearch} placeholder={t("payrolls.searchPlaceholder")} />
        <button type="button" onClick={() => setCreating(true)} className={`${toolBtn} ml-auto border-primary text-primary hover:bg-primary/5`}>
          <Plus className="size-4" /> {t("payrolls.add")}
        </button>
        <button type="button" onClick={exportCsv} className={`${toolBtn} border-[#d9dbe0] hover:border-primary hover:text-primary`}>
          <LogOut className="size-4" /> {tc("actions.export")}
        </button>
        <span className="flex size-[30px] items-center justify-center rounded-md border border-[#d9dbe0] bg-white" title={t("payrolls.columns")}>
          <Columns3 className="size-4" />
        </span>
      </div>

      <FilterSidebar className="h-fit text-[12px]">
        <FilterSection title={t("payrolls.payCycleFilter")}>
          <select aria-label={t("payrolls.payCycleFilter")} className="h-[30px] w-full rounded-md border bg-background px-2 text-[12px] outline-none" defaultValue="">
            <option value="">{t("payrolls.pickPayCycle")}</option><option value="MONTHLY">{t("payrollCreate.monthly")}</option>
          </select>
        </FilterSection>
        <FilterSection title={tc("fields.status")}>
          {PAYROLL_STATUS.map(([s, label]) => (
            <CheckOption key={s} checked={statuses.includes(s)} onChange={(on) => toggle(s, on)}>{t(label)}</CheckOption>
          ))}
        </FilterSection>
      </FilterSidebar>

      <div className="min-w-0 space-y-2.5">
        <div className="overflow-hidden rounded-lg bg-white">
          <Table stickyHeader className="text-[13px]">
            <TableHeader><TableRow className={LIST_HEAD_ROW}>
              <TableHead className="w-10 pl-3">
                <input type="checkbox" aria-label={t("commissionGrid.selectAll")} className="size-4 accent-primary"
                  checked={!!data?.items.length && checked.length === data.items.length}
                  onChange={(e) => setChecked(e.target.checked ? (data?.items ?? []).map((p) => p.id) : [])} />
              </TableHead>
              <TableHead>{tc("fields.code")}</TableHead><TableHead>{tc("fields.name")}</TableHead><TableHead>{t("payrollCreate.payCycle")}</TableHead>
              <TableHead>{t("payrollCreate.workPeriod")}</TableHead><TableHead className="text-right">{t("payslipCols.total")}</TableHead>
              <TableHead className="text-right">{t("payrolls.paidToEmployees")}</TableHead>
              <TableHead className="text-right">{t("payslipCols.remaining")}</TableHead><TableHead className="pr-4">{tc("fields.status")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {!!data?.items.length && <TableRow className="font-bold hover:bg-transparent">
                <TableCell colSpan={5} /><TableCell className="text-right">{formatMoney(data.sumTotal ?? 0)}</TableCell>
                <TableCell className="text-right">{formatMoney(data.sumPaid ?? 0)}</TableCell>
                <TableCell className="text-right">{formatMoney(data.sumRemaining ?? 0)}</TableCell><TableCell />
              </TableRow>}
              {data && !data.items.length && <ListEmptyRow cols={9} what={t("payrolls.emptyWhat")} />}
              {data?.items.map((p) => (
                <TableRow key={p.id} className="h-[41px] cursor-pointer" onClick={() => router.push(`/employees/payrolls/${p.id}`)}>
                  <TableCell className="pl-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={t("commissionGrid.selectAria", { code: p.code })} className="size-4 accent-primary" checked={checked.includes(p.id)}
                      onChange={(e) => setChecked(e.target.checked ? [...checked, p.id] : checked.filter((x) => x !== p.id))} />
                  </TableCell>
                  <TableCell>{p.code}</TableCell>
                  <TableCell className="max-w-[110px] whitespace-normal">{p.name}</TableCell>
                  <TableCell>{t("payrollCreate.monthly")}</TableCell>
                  <TableCell>{dmy(p.periodStart)} - {dmy(p.periodEnd)}</TableCell>
                  <TableCell className="text-right">{formatMoney(p.total)}</TableCell>
                  <TableCell className="text-right">{formatMoney(p.paid)}</TableCell>
                  <TableCell className="text-right">{formatMoney(p.remaining)}</TableCell>
                  <TableCell className="pr-4">{statusLabel(t, p.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end gap-2 text-[13px]">
          <span className="text-muted-foreground">{t("payrolls.pageInfo", { total: data?.total ?? 0, page: page + 1, pages })}</span>
          <button type="button" className={pagerBtn} aria-label={tc("pager.prev")} disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="size-4" /></button>
          <button type="button" className={pagerBtn} aria-label={tc("pager.next")} disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="size-4" /></button>
        </div>
      </div>
      {creating && <PayrollCreateDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

export default function Page() {
  return <DeepLinkRoute>{(link) => <PayrollsPage link={link} />}</DeepLinkRoute>;
}
