"use client";

import { useState } from "react";
import { FilterSidebar, FilterSection, RadioOption } from "@/features/sales/invoice-list-kit";
import { CatalogCreateDialog } from "./catalog-create-dialog";
import { useCatalog } from "./hr-queries";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";

export type EmployeeFilters = { status: "WORKING" | "QUIT"; departmentId: string; jobTitleId: string };

const box = "h-[30px] w-full rounded-md border border-[#d9dbe0] bg-white px-2 text-[12px] outline-none focus:border-primary";

/** Bộ lọc trái "Danh sách nhân viên" (ảnh KiotViet 111): Trạng thái, Phòng ban + Tạo mới, Chức danh + Tạo mới. */
export function EmployeeListFilterSidebar({ value, onChange }: { value: EmployeeFilters; onChange: (v: EmployeeFilters) => void }) {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const { data: departments = [] } = useCatalog("departments");
  const { data: titles = [] } = useCatalog("job-titles");
  const [creating, setCreating] = useState<"departments" | "job-titles" | null>(null);
  const head = (title: string, kind: "departments" | "job-titles") => (
    <div className="flex items-center justify-between">
      <span>{title}</span>
      <button type="button" className="text-[12px] font-normal text-primary hover:underline" onClick={() => setCreating(kind)}>{tc("actions.addNew")}</button>
    </div>
  );
  return (
    <FilterSidebar className="min-h-[470px] self-start text-[12px]">
      <FilterSection title={tc("fields.status")}>
        <RadioOption checked={value.status === "WORKING"} onSelect={() => onChange({ ...value, status: "WORKING" })}>{t("employeeStatus.working")}</RadioOption>
        <RadioOption checked={value.status === "QUIT"} onSelect={() => onChange({ ...value, status: "QUIT" })}>{t("employeeStatus.quit")}</RadioOption>
      </FilterSection>
      <section className="space-y-2 pt-2">
        <h3 className="text-[13px] font-semibold">{head(t("catalog.department"), "departments")}</h3>
        <select aria-label={t("catalog.department")} className={box} value={value.departmentId} onChange={(e) => onChange({ ...value, departmentId: e.target.value })}>
          <option value="">{t("catalog.pickDepartment")}</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </section>
      <section className="space-y-2 pt-4">
        <h3 className="text-[13px] font-semibold">{head(t("catalog.jobTitle"), "job-titles")}</h3>
        <select aria-label={t("catalog.jobTitle")} className={box} value={value.jobTitleId} onChange={(e) => onChange({ ...value, jobTitleId: e.target.value })}>
          <option value="">{t("catalog.pickJobTitle")}</option>
          {titles.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </section>
      {creating && <CatalogCreateDialog kind={creating} onClose={() => setCreating(null)} />}
    </FilterSidebar>
  );
}
