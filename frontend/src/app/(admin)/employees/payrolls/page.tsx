"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Columns3, LogOut, Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckOption, FilterSection, FilterSidebar, LIST_HEAD_ROW, ListSearch, PageTitle } from "@/features/sales/invoice-list-kit";
import { dmy, downloadCsv, usePayrolls } from "@/features/hr/hr-queries";
import { PAYROLL_STATUS, type PayrollStatus } from "@/features/hr/hr-types";
import { PayrollCreateDialog } from "@/features/hr/payroll-create-dialog";
import { formatMoney } from "@/lib/format";

const PAGE_SIZE = 15;
const pagerBtn = "flex size-7 items-center justify-center rounded-md border border-[#d9dbe0] bg-white hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40";
const toolBtn = "flex h-[30px] items-center gap-1 rounded-md border bg-white px-2.5 text-[13px] font-semibold";
export const statusLabel = (s: PayrollStatus) => PAYROLL_STATUS.find((x) => x[0] === s)?.[1] ?? s;

/** Bảng lương (ảnh KiotViet 114): lọc kỳ hạn trả + trạng thái, dòng tổng, danh sách bảng lương. */
export default function PayrollsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [statuses, setStatuses] = useState<PayrollStatus[]>(["DRAFT", "TEMP", "LOCKED"]);
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
    if (q) p.set("q", q);
    // Bỏ chọn hết trạng thái → không có bảng lương nào (giống KiotViet), gửi trạng thái không tồn tại
    (statuses.length ? statuses : ["NONE"]).forEach((s) => p.append("statuses", s));
    return p;
  }, [q, statuses, page]);
  const { data } = usePayrolls(params);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const toggle = (s: PayrollStatus, on: boolean) => { setStatuses(on ? [...statuses, s] : statuses.filter((x) => x !== s)); setPage(0); };

  const exportCsv = () => downloadCsv("bang-luong.csv", [
    ["Mã", "Tên", "Kỳ hạn trả", "Kỳ làm việc", "Tổng lương", "Đã trả nhân viên", "Còn cần trả", "Trạng thái"],
    ...(data?.items ?? []).filter((p) => !checked.length || checked.includes(p.id)).map((p) => [p.code, p.name, "Hàng tháng",
      `${dmy(p.periodStart)} - ${dmy(p.periodEnd)}`, p.total, p.paid, p.remaining, statusLabel(p.status)]),
  ]);

  return (
    <div className="grid grid-cols-[200px_minmax(0,1fr)] gap-x-2.5 gap-y-2.5">
      <PageTitle>Bảng lương</PageTitle>
      <div className="flex h-8 items-center gap-2">
        <ListSearch value={search} onChange={setSearch} placeholder="Theo mã, tên bảng lương" />
        <button type="button" onClick={() => setCreating(true)} className={`${toolBtn} ml-auto border-primary text-primary hover:bg-primary/5`}>
          <Plus className="size-4" /> Bảng tính lương
        </button>
        <button type="button" onClick={exportCsv} className={`${toolBtn} border-[#d9dbe0] hover:border-primary hover:text-primary`}>
          <LogOut className="size-4" /> Xuất file
        </button>
        <span className="flex size-[30px] items-center justify-center rounded-md border border-[#d9dbe0] bg-white" title="Cột hiển thị">
          <Columns3 className="size-4" />
        </span>
      </div>

      <FilterSidebar className="h-fit text-[12px]">
        <FilterSection title="Kỳ hạn trả lương">
          <select aria-label="Kỳ hạn trả lương" className="h-[30px] w-full rounded-md border bg-background px-2 text-[12px] outline-none" defaultValue="">
            <option value="">Chọn kỳ hạn trả lương</option><option value="MONTHLY">Hàng tháng</option>
          </select>
        </FilterSection>
        <FilterSection title="Trạng thái">
          {PAYROLL_STATUS.map(([s, label]) => (
            <CheckOption key={s} checked={statuses.includes(s)} onChange={(on) => toggle(s, on)}>{label}</CheckOption>
          ))}
        </FilterSection>
      </FilterSidebar>

      <div className="min-w-0 space-y-2.5">
        <div className="overflow-hidden rounded-lg bg-white">
          <Table className="text-[13px]">
            <TableHeader><TableRow className={LIST_HEAD_ROW}>
              <TableHead className="w-10 pl-3">
                <input type="checkbox" aria-label="Chọn tất cả" className="size-4 accent-primary"
                  checked={!!data?.items.length && checked.length === data.items.length}
                  onChange={(e) => setChecked(e.target.checked ? (data?.items ?? []).map((p) => p.id) : [])} />
              </TableHead>
              <TableHead>Mã</TableHead><TableHead>Tên</TableHead><TableHead>Kỳ hạn trả</TableHead><TableHead>Kỳ làm việc</TableHead>
              <TableHead className="text-right">Tổng lương</TableHead><TableHead className="text-right">Đã trả nhân viên</TableHead>
              <TableHead className="text-right">Còn cần trả</TableHead><TableHead className="pr-4">Trạng thái</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableRow className="font-bold hover:bg-transparent">
                <TableCell colSpan={5} /><TableCell className="text-right">{formatMoney(data?.sumTotal ?? 0)}</TableCell>
                <TableCell className="text-right">{formatMoney(data?.sumPaid ?? 0)}</TableCell>
                <TableCell className="text-right">{formatMoney(data?.sumRemaining ?? 0)}</TableCell><TableCell />
              </TableRow>
              {data && !data.items.length && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">Không tìm thấy bảng lương nào phù hợp</TableCell>
                </TableRow>
              )}
              {data?.items.map((p) => (
                <TableRow key={p.id} className="h-[41px] cursor-pointer" onClick={() => router.push(`/employees/payrolls/${p.id}`)}>
                  <TableCell className="pl-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`Chọn ${p.code}`} className="size-4 accent-primary" checked={checked.includes(p.id)}
                      onChange={(e) => setChecked(e.target.checked ? [...checked, p.id] : checked.filter((x) => x !== p.id))} />
                  </TableCell>
                  <TableCell>{p.code}</TableCell>
                  <TableCell className="max-w-[110px] whitespace-normal">{p.name}</TableCell>
                  <TableCell>Hàng tháng</TableCell>
                  <TableCell>{dmy(p.periodStart)} - {dmy(p.periodEnd)}</TableCell>
                  <TableCell className="text-right">{formatMoney(p.total)}</TableCell>
                  <TableCell className="text-right">{formatMoney(p.paid)}</TableCell>
                  <TableCell className="text-right">{formatMoney(p.remaining)}</TableCell>
                  <TableCell className="pr-4">{statusLabel(p.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end gap-2 text-[13px]">
          <span className="text-muted-foreground">{data?.total ?? 0} bảng lương · Trang {page + 1}/{pages}</span>
          <button type="button" className={pagerBtn} aria-label="Trang trước" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="size-4" /></button>
          <button type="button" className={pagerBtn} aria-label="Trang sau" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="size-4" /></button>
        </div>
      </div>
      {creating && <PayrollCreateDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
