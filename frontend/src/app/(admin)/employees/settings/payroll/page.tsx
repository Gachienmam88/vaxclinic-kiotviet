"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { SettingRow, SettingsCard, SettingsPage } from "@/features/settings/settings-layout-parts";
import { SettingSwitch } from "@/features/settings/setting-switch";
import { Hint, SaveBar, UnitBox } from "@/features/hr/hr-settings-controls";
import { HrSettingsNameListDialog } from "@/features/hr/hr-settings-name-list-dialog";
import { useHrSettings, useSaveHrSetting } from "@/features/hr/hr-queries";
import type { PayrollSettings } from "@/features/hr/hr-types";
import { SalaryTemplateDialog } from "@/features/hr/salary-template-dialog";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";

const outlineBtn = "h-[30px] rounded-md border border-primary px-2.5 text-[12px] font-semibold text-primary hover:bg-primary/5";

function Radio({ checked, onSelect, label, hint }: { checked: boolean; onSelect: () => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[12px]">
      <input type="radio" className="size-3.5 accent-primary" checked={checked} onChange={onSelect} /> {label}
      {hint && <Hint text={hint} />}
    </label>
  );
}

/** Thiết lập tính lương (ảnh KiotViet 119–120) + Thiết lập hoa hồng và thưởng. */
export default function PayrollSettingsPage() {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const { data } = useHrSettings();
  const [form, setForm] = useState<PayrollSettings | null>(null);
  const [dialog, setDialog] = useState<"templates" | "allowances" | "deductions" | null>(null);
  const save = useSaveHrSetting("payroll");
  const v = form ?? data?.payroll;
  if (!v || !data) return <p className="p-6 text-[13px] text-muted-foreground">{tc("status.loading")}</p>;
  const set = <K extends keyof PayrollSettings>(k: K, val: PayrollSettings[K]) => setForm({ ...v, [k]: val });

  return (
    <SettingsPage toc={[{ id: "thiet-lap-tinh-luong", label: t("ps.title") }, { id: "hoa-hong-thuong", label: t("ps.commissionTitle") }]}>
      <SettingsCard id="thiet-lap-tinh-luong" title={t("ps.title")}>
        <SettingRow title={t("ps.startDay")} description={t("ps.startDayHint")}>
          <div className="mt-2.5 flex items-center gap-2 pl-4 text-[12px]">{t("ps.pickStartDay")}
            <select aria-label={t("ps.startDayAria")} className="h-[26px] w-[74px] rounded-md border border-[#d9dbe0] bg-white px-1.5"
              value={v.startDay} onChange={(e) => set("startDay", Number(e.target.value))}>
              {Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{t("ps.dayN", { n: i + 1 })}</option>)}
            </select>
            <Hint text={t("ps.startDayExample")} />
          </div>
        </SettingRow>
        <SettingRow title={t("ps.hourMode")} description={t("ps.hourModeHint")}>
          <div className="mt-2.5 space-y-2 pl-4">
            <Radio checked={v.hourMode === "ACTUAL"} onSelect={() => set("hourMode", "ACTUAL")} label={t("ps.hourActual")}
              hint={t("ps.hourActualHint")} />
            <Radio checked={v.hourMode === "SHIFT"} onSelect={() => set("hourMode", "SHIFT")} label={t("ps.hourShift")}
              hint={t("ps.hourShiftHint")} />
          </div>
        </SettingRow>
        <SettingRow title={t("ps.autoCreate")} description={t("ps.autoCreateHint")}
          control={<SettingSwitch aria-label={t("ps.autoCreate")} checked={v.autoCreate} onCheckedChange={(b) => set("autoCreate", b)} />} />
        <SettingRow title={t("ps.autoUpdate")} description={t("ps.autoUpdateHint")}
          control={<SettingSwitch aria-label={t("ps.autoUpdate")} checked={v.autoUpdate} onCheckedChange={(b) => set("autoUpdate", b)} />} />
        <SettingRow title={t("templates.title")} description={t("ps.templatesHint")}
          control={<button type="button" onClick={() => setDialog("templates")} className="flex items-center gap-1 text-[13px] font-medium hover:text-primary">
            {t("ps.templateCount", { count: data.templates.length })} <ChevronRight className="size-4" /></button>} />
        <SettingRow title={t("ps.allowanceList")} description={v.allowances.length ? v.allowances.join(", ")
          : t("ps.allowanceListHint")}
          control={<button type="button" className={outlineBtn} onClick={() => setDialog("allowances")}>{t("ps.addAllowance")}</button>} />
        <SettingRow title={t("ps.deductionList")} description={v.deductions.length ? v.deductions.join(", ")
          : t("ps.deductionListHint")}
          control={<button type="button" className={outlineBtn} onClick={() => setDialog("deductions")}>{t("ps.addDeduction")}</button>} />
        <SettingRow title={t("ps.tax")} description={t("ps.taxHint")}
          control={<SettingSwitch aria-label={t("payslipCols.tax")} checked={v.taxEnabled} onCheckedChange={(b) => set("taxEnabled", b)} />}>
          {v.taxEnabled && (
            <div className="mt-2.5 flex flex-wrap items-center gap-4 pl-4 text-[12px]">
              <span className="flex items-center gap-2">{t("ps.taxRate")} <UnitBox label={t("ps.taxRate")} value={v.taxRate} unit="%" step={0.5} onChange={(n) => set("taxRate", n)} /></span>
              <span className="flex items-center gap-2">{t("ps.familyDeduction")}
                <UnitBox label={t("ps.familyDeduction")} value={v.taxDeduction} unit="VNĐ" width={90} step={100000} onChange={(n) => set("taxDeduction", n)} />
                <Hint text={t("ps.taxFormula")} /></span>
            </div>
          )}
        </SettingRow>
        <SettingRow title={t("ps.insurance")} description={t("ps.insuranceHint")}
          control={<SettingSwitch aria-label={t("payslipCols.insurance")} checked={v.insuranceEnabled} onCheckedChange={(b) => set("insuranceEnabled", b)} />}>
          {v.insuranceEnabled && (
            <div className="mt-2.5 flex items-center gap-2 pl-4 text-[12px]">{t("ps.insuranceRate")}
              <UnitBox label={t("ps.insuranceRateAria")} value={v.insuranceRate} unit="%" step={0.5} onChange={(n) => set("insuranceRate", n)} />
              <Hint text={t("ps.insuranceRateHint")} />
            </div>
          )}
        </SettingRow>
      </SettingsCard>
      <SettingsCard id="hoa-hong-thuong" title={t("ps.commissionTitle")}>
        <div className="space-y-2.5 px-5 py-3.5">
          <p className="text-[12px] font-medium">{t("ps.commissionBase")}</p>
          <div className="space-y-2 pl-4">
            <Radio checked={v.commissionBase === "NET"} onSelect={() => set("commissionBase", "NET")} label={t("ps.baseNet")} />
            <Radio checked={v.commissionBase === "PAID"} onSelect={() => set("commissionBase", "PAID")} label={t("ps.basePaid")} />
          </div>
        </div>
      </SettingsCard>
      <SaveBar dirty={!!form} pending={save.isPending} onSave={() => save.mutate(v, { onSuccess: () => setForm(null) })} />
      {dialog === "templates" && <SalaryTemplateDialog templates={data.templates} lists={v} onClose={() => setDialog(null)} />}
      {(dialog === "allowances" || dialog === "deductions") && (
        <HrSettingsNameListDialog title={dialog === "allowances" ? t("ps.allowanceList") : t("ps.deductionList")}
          placeholder={dialog === "allowances" ? t("ps.allowancePlaceholder") : t("ps.deductionPlaceholder")}
          names={dialog === "allowances" ? v.allowances : v.deductions}
          onDone={(names) => set(dialog, names)} onClose={() => setDialog(null)} />
      )}
    </SettingsPage>
  );
}
