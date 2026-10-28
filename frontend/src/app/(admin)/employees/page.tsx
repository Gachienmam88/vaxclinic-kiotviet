"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, ClipboardCheck, Download, Plus, Search, TriangleAlert, UserRound } from "lucide-react";
import { DeepLinkRoute, useDeepLinkExpanded, type DeepLink } from "@/components/ui/deep-link-route";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListEmptyRow } from "@/components/ui/list-empty-state";
import { LIST_HEAD_ROW } from "@/features/sales/invoice-list-kit";
import { EmployeeDetailPanel } from "@/features/hr/employee-detail-panel";
import { EmployeeFormDialog } from "@/features/hr/employee-form-dialog";
import { EmployeeListFilterSidebar, type EmployeeFilters } from "@/features/hr/employee-list-filter-sidebar";
import { HrStartWidget } from "@/features/hr/hr-start-widget";
import { downloadCsv, useEmployee, useEmployees } from "@/features/hr/hr-queries";
import { salaryTypeLabel } from "@/features/hr/hr-types";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const COLS = 9;
const btn = "flex h-[30px] items-center gap-1 rounded-md border bg-white px-2.5 text-[13px] font-semibold";
const pagerBtn = "flex size-7 items-center justify-center rounded-md border border-[#d9dbe0] bg-white hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40";

/** Danh sách nhân viên (ảnh KiotViet 111). ?create=1 mở popup thêm nhân viên (từ màn Khởi tạo); ?code=NV… lọc mã + mở chi tiết (mọi trạng thái). */
function EmployeesPage({ link }: { link: DeepLink }) {
  const sp = useSearchParams();
  const [search, setSearch] = useState(link.code ?? "");
  const [q, setQ] = useState(link.code ?? "");
  // Link sâu: tìm cả nhân viên đã nghỉ cho tới khi người dùng đổi bộ lọc
  const [anyStatus, setAnyStatus] = useState(!!link.code);
  const [filters, setFilters] = useState<EmployeeFilters>({ status: "WORKING", departmentId: "", jobTitleId: "" });
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(sp.get("create") === "1");
  const [salaryFor, setSalaryFor] = useState<string | null>(null);
  const { data: salaryEmp } = useEmployee(salaryFor);
  useEffect(() => { const t = setTimeout(() => { setQ(search); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
    if (!anyStatus) p.set("status", filters.status);
    if (q) p.set("q", q);
    if (filters.departmentId) p.set("departmentId", filters.departmentId);
    if (filters.jobTitleId) p.set("jobTitleId", filters.jobTitleId);
    return p;
  }, [q, filters, page, anyStatus]);
  const { data } = useEmployees(params);
  const row = useDeepLinkExpanded(data?.items, link, (e) => [e.code]);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const exportCsv = () => downloadCsv("danh-sach-nhan-vien.csv", [
    ["Mã nhân viên", "Mã chấm công", "Tên nhân viên", "Số điện thoại", "Số CMND/CCCD", "Phòng ban", "Chức danh", "Loại lương", "Mức lương", "Nợ và tạm ứng", "Ghi chú"],
    ...(data?.items ?? []).map((e) => [e.code, e.timekeepingCode, e.name, e.phone, e.idNumber, e.departmentName, e.jobTitleName,
      salaryTypeLabel(e.salaryType), e.salaryType ? e.salaryAmount : "", e.debt, e.note]),
  ]);

  return (
    <div className="grid grid-cols-[166px_minmax(0,1fr)] gap-x-2.5 gap-y-2.5">
      <h1 className="flex h-8 items-center text-[18px] font-bold whitespace-nowrap">Danh sách nhân viên</h1>
      <div className="flex h-8 items-center gap-2">
        <div className="relative h-[30px] w-[300px] max-w-full">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input className="size-full rounded-md border border-[#d9dbe0] bg-white pr-2.5 pl-8 text-[13px] outline-none placeholder:text-muted-foreground focus:border-primary"
            placeholder="Tìm theo mã, tên nhân viên" aria-label="Tìm nhân viên" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="button" onClick={() => setCreating(true)} className={cn(btn, "ml-auto border-primary text-primary hover:bg-primary/5")}>
          <Plus className="size-4" /> Nhân viên
        </button>
        <Link href="/employees/timesheets" className={cn(btn, "border-[#d9dbe0] hover:border-primary")}><ClipboardCheck className="size-4" /> Duyệt yêu cầu</Link>
        <button type="button" onClick={exportCsv} className={cn(btn, "border-[#d9dbe0] hover:border-primary")} aria-label="Xuất file"><Download className="size-4" /></button>
      </div>

      <EmployeeListFilterSidebar value={filters} onChange={(v) => { setFilters(v); setPage(0); setAnyStatus(false); }} />

      <div className="min-w-0 space-y-2.5">
        <div className="min-h-[470px] overflow-hidden rounded-lg bg-white">
          <Table className="text-[12px]">
            <TableHeader><TableRow className={LIST_HEAD_ROW}>
              <TableHead className="w-9 pl-3"><input type="checkbox" aria-label="Chọn tất cả" className="size-3.5" /></TableHead>
              <TableHead className="w-8" /><TableHead>Mã nhân viên</TableHead><TableHead>Mã chấm công</TableHead>
              <TableHead>Tên nhân viên</TableHead><TableHead className="w-8" /><TableHead>Số điện thoại</TableHead>
              <TableHead>Số CMND/CCCD</TableHead><TableHead className="text-right">Nợ và tạm ứng</TableHead><TableHead className="pr-4">Ghi chú</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data && !data.items.length && <ListEmptyRow cols={COLS + 1} what="nhân viên" />}
              {data?.items.map((e) => {
                const open = row.open === e.id;
                return (
                  <Fragment key={e.id}>
                    <TableRow aria-expanded={open} onClick={() => row.toggle(e.id)}
                      className={cn("h-[30px] cursor-pointer", open && "bg-primary-tint font-semibold hover:bg-primary-tint")}>
                      <TableCell className="pl-3" onClick={(ev) => ev.stopPropagation()}><input type="checkbox" aria-label={`Chọn ${e.name}`} className="size-3.5" /></TableCell>
                      <TableCell><span className="flex size-[18px] items-center justify-center rounded-full bg-primary-tint-strong text-primary"><UserRound className="size-3" /></span></TableCell>
                      <TableCell>{e.code}</TableCell><TableCell>{e.timekeepingCode}</TableCell>
                      <TableCell className="uppercase">{e.name}</TableCell>
                      <TableCell>
                        {!e.salaryType && (
                          <button type="button" title="Chưa thiết lập lương" aria-label="Chưa thiết lập lương"
                            onClick={(ev) => { ev.stopPropagation(); setSalaryFor(e.id); }}>
                            <TriangleAlert className="size-4 text-[#f59e0b]" />
                          </button>
                        )}
                      </TableCell>
                      <TableCell>{e.phone}</TableCell><TableCell>{e.idNumber}</TableCell>
                      <TableCell className="text-right">{formatMoney(e.debt)}</TableCell>
                      <TableCell className="max-w-[200px] truncate pr-4">{e.note}</TableCell>
                    </TableRow>
                    {open && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={COLS + 1} className="p-0 whitespace-normal"><EmployeeDetailPanel id={e.id} /></TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end gap-2 text-[13px]">
          <span className="text-muted-foreground">{data?.total ?? 0} nhân viên · Trang {page + 1}/{pages}</span>
          <button type="button" className={pagerBtn} aria-label="Trang trước" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft className="size-4" /></button>
          <button type="button" className={pagerBtn} aria-label="Trang sau" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><ChevronRight className="size-4" /></button>
        </div>
      </div>
      {creating && <EmployeeFormDialog onClose={() => setCreating(false)} />}
      {salaryEmp && salaryFor && <EmployeeFormDialog employee={salaryEmp} tab="salary" onClose={() => setSalaryFor(null)} />}
      <HrStartWidget />
    </div>
  );
}

export default function Page() {
  return <DeepLinkRoute>{(link) => <EmployeesPage link={link} />}</DeepLinkRoute>;
}
