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
import { DatePicker } from "@/components/ui/date-picker";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";

const toRequest = (e?: Employee): EmployeeRequest => ({
  code: e?.code ?? "", timekeepingCode: e?.timekeepingCode ?? "", name: e?.name ?? "", phone: e?.phone ?? "", idNumber: e?.idNumber ?? "",
  birthday: e?.birthday ?? "", gender: e?.gender ?? null, startDate: e?.startDate ?? "", endDate: e?.endDate ?? "", mainBranchId: e?.mainBranchId ?? null,
  branchIds: e?.branches.map((b) => b.id) ?? [], departmentId: e?.departmentId ?? null, jobTitleId: e?.jobTitleId ?? null,
  userId: e?.userId ?? null, status: e?.status ?? "WORKING", note: e?.note ?? "", salaryType: e?.salaryType ?? null,
  salaryAmount: e?.salaryAmount ?? 0, overtimePercent: e?.overtimePercent ?? 150, commissionTableId: e?.commissionTableId ?? null,
  allowances: e?.allowances ?? [], deductions: e?.deductions ?? [],
});

/** Thêm / sửa nhân viên: tab Thông tin + tab Thiết lập lương. tab="salary" mở thẳng tab lương (biểu tượng cảnh báo). */
export function EmployeeFormDialog({ employee, tab = "info", onClose }: { employee?: Employee; tab?: "info" | "salary"; onClose: () => void }) {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const [f, setF] = useState<EmployeeRequest>(() => toRequest(employee));
  const [creating, setCreating] = useState<"departments" | "job-titles" | null>(null);
  const set = (patch: Partial<EmployeeRequest>) => setF((x) => ({ ...x, ...patch }));
  const { data: branches = [] } = useBranches();
  const { data: departments = [] } = useCatalog("departments");
  const { data: titles = [] } = useCatalog("job-titles");
  const { data: users = [] } = useUserLookup();
  const save = useHrMutation(() => {
    const body = { ...f, birthday: f.birthday || null, startDate: f.startDate || null, endDate: f.endDate || null,
      allowances: f.allowances?.filter((a) => a.name.trim()), deductions: f.deductions?.filter((a) => a.name.trim()) };
    return employee ? api<Employee>(`/hr/employees/${employee.id}`, { method: "PUT", body }) : api<Employee>("/hr/employees", { method: "POST", body });
  }, employee ? t("employeeForm.toastUpdated") : t("employeeForm.toastAdded"), onClose);
  const text = (k: "code" | "timekeepingCode" | "name" | "phone" | "idNumber", placeholder?: string) => (
    <input className={hrInput} value={f[k] ?? ""} placeholder={placeholder} onChange={(e) => set({ [k]: e.target.value })} />
  );
  const toggleBranch = (id: string, on: boolean) => set({ branchIds: on ? [...(f.branchIds ?? []), id] : (f.branchIds ?? []).filter((b) => b !== id) });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-3 sm:max-w-[760px]">
        <DialogHeader><DialogTitle>{employee ? t("employeeForm.editTitle") : t("employeeForm.addTitle")}</DialogTitle></DialogHeader>
        <Tabs defaultValue={tab}>
          <TabsList variant="line" className={kvTabsList}>
            <TabsTrigger value="info" className={kvTabsTrigger}>{t("employeeForm.tabInfo")}</TabsTrigger>
            <TabsTrigger value="salary" className={kvTabsTrigger}>{t("employeeForm.tabSalary")}</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="max-h-[60vh] overflow-y-auto pt-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              <HrField label={t("employee.code")}>{text("code", t("employeeForm.autoCode"))}</HrField>
              <HrField label={t("employee.timekeepingCode")}>{text("timekeepingCode", t("employeeForm.machineCode"))}</HrField>
              <HrField label={`${t("employee.name")} *`}>{text("name")}</HrField>
              <HrField label={t("employee.phone")}>{text("phone")}</HrField>
              <HrField label={t("employee.idNumber")}>{text("idNumber")}</HrField>
              <HrField label={t("employee.birthday")}><DatePicker className={hrInput} value={f.birthday ?? ""} onChange={(v) => set({ birthday: v })} /></HrField>
              <HrField label={t("employee.gender")}>
                <select className={hrInput} value={f.gender ?? ""} onChange={(e) => set({ gender: (e.target.value || null) as EmployeeRequest["gender"] })}>
                  <option value="">{t("employeeForm.pickGender")}</option><option value="MALE">{t("employee.male")}</option><option value="FEMALE">{t("employee.female")}</option>
                </select>
              </HrField>
              <HrField label={t("employee.startDate")}><DatePicker className={hrInput} value={f.startDate ?? ""} onChange={(v) => set({ startDate: v })} /></HrField>
              <HrField label={t("employee.endDate")}><DatePicker className={hrInput} value={f.endDate ?? ""} onChange={(v) => set({ endDate: v })} /></HrField>
              <HrField label={tc("fields.status")}>
                <select className={hrInput} value={f.status ?? "WORKING"} onChange={(e) => set({ status: e.target.value as "WORKING" | "QUIT" })}>
                  <option value="WORKING">{t("employeeStatus.working")}</option><option value="QUIT">{t("employeeStatus.quit")}</option>
                </select>
              </HrField>
              <HrField label={t("catalog.department")}>
                <div className="flex gap-1.5">
                  <select className={hrInput} value={f.departmentId ?? ""} onChange={(e) => set({ departmentId: e.target.value || null })}>
                    <option value="">{t("catalog.pickDepartment")}</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <button type="button" className="shrink-0 text-[12px] text-primary" onClick={() => setCreating("departments")}>{tc("actions.addNew")}</button>
                </div>
              </HrField>
              <HrField label={t("catalog.jobTitle")}>
                <div className="flex gap-1.5">
                  <select className={hrInput} value={f.jobTitleId ?? ""} onChange={(e) => set({ jobTitleId: e.target.value || null })}>
                    <option value="">{t("catalog.pickJobTitle")}</option>{titles.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <button type="button" className="shrink-0 text-[12px] text-primary" onClick={() => setCreating("job-titles")}>{tc("actions.addNew")}</button>
                </div>
              </HrField>
              <HrField label={t("employeeForm.payBranch")}>
                <select className={hrInput} value={f.mainBranchId ?? ""} onChange={(e) => set({ mainBranchId: e.target.value || null })}>
                  <option value="">{t("advance.pickBranch")}</option>{branches.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </HrField>
              <HrField label={t("employeeForm.loginAccount")}>
                <select className={hrInput} value={f.userId ?? ""} onChange={(e) => set({ userId: e.target.value || null })}>
                  <option value="">{t("employeeForm.notLinked")}</option>{users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select>
              </HrField>
              <div className="col-span-2 grid grid-cols-[130px_minmax(0,1fr)] gap-2 text-[13px]">
                <span className="text-foreground/80">{t("employee.branches")}</span>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {branches.filter((b) => b.active).map((b) => (
                    <label key={b.id} className="flex items-center gap-1.5">
                      <input type="checkbox" className="size-3.5 accent-primary" checked={(f.branchIds ?? []).includes(b.id) || f.mainBranchId === b.id}
                        disabled={f.mainBranchId === b.id} onChange={(e) => toggleBranch(b.id, e.target.checked)} /> {b.name}
                    </label>
                  ))}
                </div>
              </div>
              <HrField label={tc("fields.note")} className="col-span-2">
                <input className={hrInput} value={f.note ?? ""} maxLength={500} onChange={(e) => set({ note: e.target.value })} />
              </HrField>
            </div>
            <p className="mt-3 text-[12px] text-muted-foreground">{t("employeeForm.linkHint")}</p>
          </TabsContent>
          <TabsContent value="salary" className="max-h-[60vh] overflow-y-auto pt-3">
            <EmployeeFormSalaryTab f={f} set={set} />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tc("actions.skip")}</Button>
          <Button disabled={!f.name.trim() || save.isPending} onClick={() => save.mutate(undefined)}>{tc("actions.save")}</Button>
        </DialogFooter>
        {creating && <CatalogCreateDialog kind={creating} onClose={() => setCreating(null)}
          onCreated={(c) => set(creating === "departments" ? { departmentId: c.id } : { jobTitleId: c.id })} />}
      </DialogContent>
    </Dialog>
  );
}
