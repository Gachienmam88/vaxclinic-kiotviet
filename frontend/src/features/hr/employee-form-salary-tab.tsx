"use client";

import { useCommissionTables, useHrSettings } from "./hr-queries";
import { SALARY_TYPES, type EmployeeRequest, type SalaryType } from "./hr-types";
import { HrField, MoneyInput, hrInput } from "./hr-form-ui";
import { PayItemsEditor } from "./employee-pay-items-editor";
import { ALLOWANCE_KINDS, DEDUCTION_KINDS } from "./salary-template-pay-items";
import { useT } from "@/lib/i18n";
import { hrNs } from "@/messages/hr";

/** Tab "Thiết lập lương": mẫu lương, loại lương + mức lương, % lương làm thêm giờ, bảng hoa hồng, phụ cấp, giảm trừ. */
export function EmployeeFormSalaryTab({ f, set }: { f: EmployeeRequest; set: (patch: Partial<EmployeeRequest>) => void }) {
  const tr = useT(hrNs);
  const { data: settings } = useHrSettings();
  const { data: tables = [] } = useCommissionTables();
  const templates = settings?.templates ?? [];
  const unit = SALARY_TYPES.find((s) => s[0] === f.salaryType)?.[2];
  return (
    <div className="space-y-3">
      {templates.length > 0 && (
        <HrField label={tr("salaryTab.template")}>
          <select className={hrInput} defaultValue="" onChange={(e) => {
            const t = templates.find((x) => x.id === e.target.value);
            if (t) set({ salaryType: t.salaryType, salaryAmount: t.salaryAmount ?? 0, overtimePercent: t.overtimePercent ?? 150,
              commissionTableId: t.commissionTableId, allowances: t.allowances, deductions: t.deductions });
          }}>
            <option value="">{tr("salaryTab.pickTemplate")}</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </HrField>
      )}
      <HrField label={tr("salaryTab.salaryType")}>
        <select className={hrInput} value={f.salaryType ?? ""} onChange={(e) => set({ salaryType: (e.target.value || null) as SalaryType | null })}>
          <option value="">{tr("salaryTab.noSalary")}</option>
          {SALARY_TYPES.map(([v, l]) => <option key={v} value={v}>{tr(l)}</option>)}
        </select>
      </HrField>
      {f.salaryType && (
        <>
          <HrField label={tr("salaryTab.amount")}>
            <div className="flex items-center gap-2">
              <MoneyInput value={f.salaryAmount} onChange={(v) => set({ salaryAmount: v })} />
              <span className="w-24 shrink-0 text-[12px] text-muted-foreground">{unit ? tr(unit) : ""}</span>
            </div>
          </HrField>
          <HrField label={tr("salaryTab.overtime")}>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={1000} className={hrInput} value={f.overtimePercent ?? 150}
                onChange={(e) => set({ overtimePercent: Number(e.target.value) })} />
              <span className="w-24 shrink-0 text-[12px] text-muted-foreground">{tr("salaryTab.overtimeUnit")}</span>
            </div>
          </HrField>
        </>
      )}
      <HrField label={tr("salaryTab.commissionTable")}>
        <select className={hrInput} value={f.commissionTableId ?? ""} onChange={(e) => set({ commissionTableId: e.target.value || null })}>
          <option value="">{tr("salaryTab.notApplied")}</option>
          {tables.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </HrField>
      <PayItemsEditor title={tr("payslip.allowances")} items={f.allowances ?? []} suggestions={settings?.payroll.allowances ?? []}
        kinds={ALLOWANCE_KINDS} onChange={(v) => set({ allowances: v })} />
      <PayItemsEditor title={tr("payslip.deductions")} items={f.deductions ?? []} suggestions={settings?.payroll.deductions ?? []}
        kinds={DEDUCTION_KINDS} onChange={(v) => set({ deductions: v })} />
    </div>
  );
}
