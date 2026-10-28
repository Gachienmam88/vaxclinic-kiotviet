"use client";

import { useCommissionTables, useHrSettings } from "./hr-queries";
import { SALARY_TYPES, type EmployeeRequest, type SalaryType } from "./hr-types";
import { HrField, MoneyInput, hrInput } from "./hr-form-ui";
import { PayItemsEditor } from "./employee-pay-items-editor";

/** Tab "Thiết lập lương": mẫu lương, loại lương + mức lương, % lương làm thêm giờ, bảng hoa hồng, phụ cấp, giảm trừ. */
export function EmployeeFormSalaryTab({ f, set }: { f: EmployeeRequest; set: (patch: Partial<EmployeeRequest>) => void }) {
  const { data: settings } = useHrSettings();
  const { data: tables = [] } = useCommissionTables();
  const templates = settings?.templates ?? [];
  const unit = SALARY_TYPES.find((s) => s[0] === f.salaryType)?.[2];
  return (
    <div className="space-y-3">
      {templates.length > 0 && (
        <HrField label="Mẫu lương">
          <select className={hrInput} defaultValue="" onChange={(e) => {
            const t = templates.find((x) => x.id === e.target.value);
            if (t) set({ salaryType: t.salaryType, salaryAmount: t.salaryAmount ?? 0, overtimePercent: t.overtimePercent ?? 150,
              commissionTableId: t.commissionTableId, allowances: t.allowances, deductions: t.deductions });
          }}>
            <option value="">Chọn mẫu lương có sẵn</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </HrField>
      )}
      <HrField label="Loại lương">
        <select className={hrInput} value={f.salaryType ?? ""} onChange={(e) => set({ salaryType: (e.target.value || null) as SalaryType | null })}>
          <option value="">Chưa thiết lập lương</option>
          {SALARY_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </HrField>
      {f.salaryType && (
        <>
          <HrField label="Mức lương">
            <div className="flex items-center gap-2">
              <MoneyInput value={f.salaryAmount} onChange={(v) => set({ salaryAmount: v })} />
              <span className="w-24 shrink-0 text-[12px] text-muted-foreground">{unit}</span>
            </div>
          </HrField>
          <HrField label="Lương làm thêm giờ">
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={1000} className={hrInput} value={f.overtimePercent ?? 150}
                onChange={(e) => set({ overtimePercent: Number(e.target.value) })} />
              <span className="w-24 shrink-0 text-[12px] text-muted-foreground">% lương giờ</span>
            </div>
          </HrField>
        </>
      )}
      <HrField label="Bảng hoa hồng">
        <select className={hrInput} value={f.commissionTableId ?? ""} onChange={(e) => set({ commissionTableId: e.target.value || null })}>
          <option value="">Không áp dụng</option>
          {tables.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </HrField>
      <PayItemsEditor title="Phụ cấp" items={f.allowances ?? []} suggestions={settings?.payroll.allowances ?? []}
        kinds={[["DAY", "Theo ngày làm việc"], ["MONTH", "Cố định hàng tháng"]]} onChange={(v) => set({ allowances: v })} />
      <PayItemsEditor title="Giảm trừ" items={f.deductions ?? []} suggestions={settings?.payroll.deductions ?? []}
        kinds={[["LATE", "Mỗi lần đi muộn"], ["EARLY", "Mỗi lần về sớm"], ["MONTH", "Cố định hàng tháng"]]} onChange={(v) => set({ deductions: v })} />
    </div>
  );
}
