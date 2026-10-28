"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { kvTabsList, kvTabsTrigger } from "@/features/sales/customer-ui-primitives";
import { useUserLookup } from "@/features/purchases/purchase-queries";
import { useBranches } from "@/features/settings/settings-queries";
import { api } from "@/lib/api-client";
import { CatalogCreateDialog } from "./catalog-create-dialog";
import { EmployeeFormSalaryTab } from "./employee-form-salary-tab";
import { HrField, hrInput } from "./hr-form-ui";
import { useCatalog, useHrMutation } from "./hr-queries";
import type { Employee, EmployeeRequest } from "./hr-types";

const toRequest = (e?: Employee): EmployeeRequest => ({
  code: e?.code ?? "", timekeepingCode: e?.timekeepingCode ?? "", name: e?.name ?? "", phone: e?.phone ?? "", idNumber: e?.idNumber ?? "",
  birthday: e?.birthday ?? "", gender: e?.gender ?? null, startDate: e?.startDate ?? "", mainBranchId: e?.mainBranchId ?? null,
  branchIds: e?.branches.map((b) => b.id) ?? [], departmentId: e?.departmentId ?? null, jobTitleId: e?.jobTitleId ?? null,
  userId: e?.userId ?? null, status: e?.status ?? "WORKING", note: e?.note ?? "", salaryType: e?.salaryType ?? null,
  salaryAmount: e?.salaryAmount ?? 0, overtimePercent: e?.overtimePercent ?? 150, commissionTableId: e?.commissionTableId ?? null,
  allowances: e?.allowances ?? [], deductions: e?.deductions ?? [],
});

/** Thêm / sửa nhân viên: tab Thông tin + tab Thiết lập lương. tab="salary" mở thẳng tab lương (biểu tượng cảnh báo). */
export function EmployeeFormDialog({ employee, tab = "info", onClose }: { employee?: Employee; tab?: "info" | "salary"; onClose: () => void }) {
  const [f, setF] = useState<EmployeeRequest>(() => toRequest(employee));
  const [creating, setCreating] = useState<"departments" | "job-titles" | null>(null);
  const set = (patch: Partial<EmployeeRequest>) => setF((x) => ({ ...x, ...patch }));
  const { data: branches = [] } = useBranches();
  const { data: departments = [] } = useCatalog("departments");
  const { data: titles = [] } = useCatalog("job-titles");
  const { data: users = [] } = useUserLookup();
  const save = useHrMutation(() => {
    const body = { ...f, birthday: f.birthday || null, startDate: f.startDate || null,
      allowances: f.allowances?.filter((a) => a.name.trim()), deductions: f.deductions?.filter((a) => a.name.trim()) };
    return employee ? api<Employee>(`/hr/employees/${employee.id}`, { method: "PUT", body }) : api<Employee>("/hr/employees", { method: "POST", body });
  }, employee ? "Đã cập nhật nhân viên" : "Đã thêm nhân viên", onClose);
  const text = (k: "code" | "timekeepingCode" | "name" | "phone" | "idNumber", placeholder?: string) => (
    <input className={hrInput} value={f[k] ?? ""} placeholder={placeholder} onChange={(e) => set({ [k]: e.target.value })} />
  );
  const toggleBranch = (id: string, on: boolean) => set({ branchIds: on ? [...(f.branchIds ?? []), id] : (f.branchIds ?? []).filter((b) => b !== id) });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-3 sm:max-w-[760px]">
        <DialogHeader><DialogTitle>{employee ? "Sửa nhân viên" : "Thêm mới nhân viên"}</DialogTitle></DialogHeader>
        <Tabs defaultValue={tab}>
          <TabsList variant="line" className={kvTabsList}>
            <TabsTrigger value="info" className={kvTabsTrigger}>Thông tin</TabsTrigger>
            <TabsTrigger value="salary" className={kvTabsTrigger}>Thiết lập lương</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="max-h-[60vh] overflow-y-auto pt-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              <HrField label="Mã nhân viên">{text("code", "Mã tự động")}</HrField>
              <HrField label="Mã chấm công">{text("timekeepingCode", "Mã trên máy chấm công")}</HrField>
              <HrField label="Tên nhân viên *">{text("name")}</HrField>
              <HrField label="Số điện thoại">{text("phone")}</HrField>
              <HrField label="Số CMND/CCCD">{text("idNumber")}</HrField>
              <HrField label="Ngày sinh"><input type="date" className={hrInput} value={f.birthday ?? ""} onChange={(e) => set({ birthday: e.target.value })} /></HrField>
              <HrField label="Giới tính">
                <select className={hrInput} value={f.gender ?? ""} onChange={(e) => set({ gender: (e.target.value || null) as EmployeeRequest["gender"] })}>
                  <option value="">Chọn giới tính</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option>
                </select>
              </HrField>
              <HrField label="Ngày bắt đầu làm"><input type="date" className={hrInput} value={f.startDate ?? ""} onChange={(e) => set({ startDate: e.target.value })} /></HrField>
              <HrField label="Phòng ban">
                <div className="flex gap-1.5">
                  <select className={hrInput} value={f.departmentId ?? ""} onChange={(e) => set({ departmentId: e.target.value || null })}>
                    <option value="">Chọn phòng ban</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <button type="button" className="shrink-0 text-[12px] text-primary" onClick={() => setCreating("departments")}>Tạo mới</button>
                </div>
              </HrField>
              <HrField label="Chức danh">
                <div className="flex gap-1.5">
                  <select className={hrInput} value={f.jobTitleId ?? ""} onChange={(e) => set({ jobTitleId: e.target.value || null })}>
                    <option value="">Chọn chức danh</option>{titles.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <button type="button" className="shrink-0 text-[12px] text-primary" onClick={() => setCreating("job-titles")}>Tạo mới</button>
                </div>
              </HrField>
              <HrField label="Chi nhánh trả lương">
                <select className={hrInput} value={f.mainBranchId ?? ""} onChange={(e) => set({ mainBranchId: e.target.value || null })}>
                  <option value="">Chọn chi nhánh</option>{branches.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </HrField>
              <HrField label="Tài khoản đăng nhập">
                <select className={hrInput} value={f.userId ?? ""} onChange={(e) => set({ userId: e.target.value || null })}>
                  <option value="">Không liên kết</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select>
              </HrField>
              <div className="col-span-2 grid grid-cols-[130px_minmax(0,1fr)] gap-2 text-[13px]">
                <span className="text-foreground/80">Chi nhánh làm việc</span>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {branches.filter((b) => b.active).map((b) => (
                    <label key={b.id} className="flex items-center gap-1.5">
                      <input type="checkbox" className="size-3.5 accent-primary" checked={(f.branchIds ?? []).includes(b.id) || f.mainBranchId === b.id}
                        disabled={f.mainBranchId === b.id} onChange={(e) => toggleBranch(b.id, e.target.checked)} /> {b.name}
                    </label>
                  ))}
                </div>
              </div>
              <HrField label="Ghi chú" className="col-span-2">
                <input className={hrInput} value={f.note ?? ""} maxLength={500} onChange={(e) => set({ note: e.target.value })} />
              </HrField>
            </div>
            <p className="mt-3 text-[12px] text-muted-foreground">Liên kết tài khoản đăng nhập để nhân viên chấm công trên điện thoại và nhận hoa hồng theo hóa đơn họ bán.</p>
          </TabsContent>
          <TabsContent value="salary" className="max-h-[60vh] overflow-y-auto pt-3">
            <EmployeeFormSalaryTab f={f} set={set} />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button disabled={!f.name.trim() || save.isPending} onClick={() => save.mutate(undefined)}>Lưu</Button>
        </DialogFooter>
        {creating && <CatalogCreateDialog kind={creating} onClose={() => setCreating(null)}
          onCreated={(c) => set(creating === "departments" ? { departmentId: c.id } : { jobTitleId: c.id })} />}
      </DialogContent>
    </Dialog>
  );
}
