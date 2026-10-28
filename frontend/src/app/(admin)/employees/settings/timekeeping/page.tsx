"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { SettingRow, SettingsCard, SettingsPage } from "@/features/settings/settings-layout-parts";
import { SettingSwitch } from "@/features/settings/setting-switch";
import { CheckLine, DurationBox, Hint, SaveBar, UnitBox } from "@/features/hr/hr-settings-controls";
import { ShiftFormDialog } from "@/features/hr/shift-form-dialog";
import { useHrSettings, useSaveHrSetting, useShifts } from "@/features/hr/hr-queries";
import type { TimekeepingSettings } from "@/features/hr/hr-types";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";
import { renderRichText } from "@/lib/i18n/render-rich-text";

/** Thiết lập chấm công (ảnh KiotViet 117–118). */
export default function TimekeepingSettingsPage() {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const { data } = useHrSettings();
  const { data: shifts = [] } = useShifts();
  const [form, setForm] = useState<TimekeepingSettings | null>(null);
  const [shiftsOpen, setShiftsOpen] = useState(false);
  const save = useSaveHrSetting("timekeeping");
  const v = form ?? data?.timekeeping;
  if (!v) return <p className="p-6 text-[13px] text-muted-foreground">{tc("status.loading")}</p>;
  const set = <K extends keyof TimekeepingSettings>(k: K, val: TimekeepingSettings[K]) => setForm({ ...v, [k]: val });
  const conv = !v.convertEnabled;

  return (
    <SettingsPage toc={[{ id: "che-do-cham-cong", label: t("tk.toc") }]}>
      <SettingsCard id="che-do-cham-cong" title={t("tk.title")}>
        <SettingRow title={t("tk.shifts")} description={t("tk.shiftsHint")}
          control={<button type="button" onClick={() => setShiftsOpen(true)} className="flex items-center gap-1 text-[13px] font-medium hover:text-primary">
            {t("tk.shiftCount", { count: shifts.filter((s) => s.active).length })} <ChevronRight className="size-4" /></button>} />
        <SettingRow title={t("tk.workHours")} description={t("tk.workHoursHint")}>
          <div className="mt-3 space-y-3 pl-4 text-[12px]">
            <div className="flex items-center gap-2">{renderRichText(t("tk.standardHours"), {
              box: <UnitBox label={t("tk.standardHoursAria")} value={v.standardHours} unit={t("units.hour")} step={0.5} onChange={(n) => set("standardHours", n)} /> })}
              <Hint text={t("tk.standardHoursHint")} />
            </div>
            <CheckLine checked={v.convertEnabled} onChange={(b) => set("convertEnabled", b)} label={t("tk.convert")}
              hint={t("tk.convertHint")} />
            <div className="grid grid-cols-[24px_auto_auto_auto_1fr] items-center gap-x-2 gap-y-2.5 pl-4">
              <span>{t("tk.from")}</span><DurationBox label={t("tk.halfMark")} minutes={v.halfFrom} disabled={conv} onChange={(m) => set("halfFrom", m)} />
              <span>{t("tk.below")}</span><DurationBox label={t("tk.fullMark")} minutes={v.fullFrom} disabled={conv} onChange={(m) => set("fullFrom", m)} />
              <span className="pl-4">{t("tk.recordHalf")}</span>
              <span>{t("tk.from")}</span><DurationBox label={t("tk.fullMarkFrom")} minutes={v.fullFrom} disabled={conv} onChange={(m) => set("fullFrom", m)} />
              <span>{t("tk.orMore")}</span><span /><span className="pl-4">{t("tk.recordFull")}</span>
            </div>
            {v.convertEnabled && v.fullFrom <= v.halfFrom && <p className="pl-4 text-destructive">{t("tk.markError")}</p>}
            <div className="pl-4">
              <CheckLine checked={v.lateEarlyForHalf} disabled={conv} onChange={(b) => set("lateEarlyForHalf", b)}
                label={t("tk.lateEarlyForHalf")} />
            </div>
          </div>
        </SettingRow>
        <SettingRow title={t("tk.lateEarly")} description={t("tk.lateEarlyHint")}>
          <div className="mt-3 space-y-2.5 pl-4">
            <CheckLine checked={v.lateEnabled} onChange={(b) => set("lateEnabled", b)} label={t("tk.lateAfter")}
              hint={t("tk.lateAfterHint")}>
              <UnitBox label={t("tk.lateAfterAria")} value={v.lateAfter} unit={t("units.minute")} disabled={!v.lateEnabled} onChange={(n) => set("lateAfter", n)} />
            </CheckLine>
            <CheckLine checked={v.earlyEnabled} onChange={(b) => set("earlyEnabled", b)} label={t("tk.earlyBefore")}
              hint={t("tk.earlyBeforeHint")}>
              <UnitBox label={t("tk.earlyBeforeAria")} value={v.earlyBefore} unit={t("units.minute")} disabled={!v.earlyEnabled} onChange={(n) => set("earlyBefore", n)} />
            </CheckLine>
          </div>
        </SettingRow>
        <SettingRow title={t("tk.overtime")} description={t("tk.overtimeHint")}>
          <div className="mt-3 space-y-2.5 pl-4">
            <CheckLine checked={v.otBeforeEnabled} onChange={(b) => set("otBeforeEnabled", b)} label={t("tk.otBefore")}
              hint={t("tk.otBeforeHint")}>
              <UnitBox label={t("tk.otBeforeAria")} value={v.otBefore} unit={t("units.minute")} disabled={!v.otBeforeEnabled} onChange={(n) => set("otBefore", n)} />
            </CheckLine>
            <CheckLine checked={v.otAfterEnabled} onChange={(b) => set("otAfterEnabled", b)} label={t("tk.otAfter")}
              hint={t("tk.otAfterHint")}>
              <UnitBox label={t("tk.otAfterAria")} value={v.otAfter} unit={t("units.minute")} disabled={!v.otAfterEnabled} onChange={(n) => set("otAfter", n)} />
            </CheckLine>
            <div className="pl-4">
              <CheckLine checked={v.otActualAll} onChange={(b) => set("otActualAll", b)} label={t("tk.otActualAll")}
                hint={t("tk.otActualAllHint")} />
            </div>
          </div>
        </SettingRow>
        <SettingRow title={t("tk.singleInOut")}
          description={t("tk.singleInOutHint")}
          control={<SettingSwitch aria-label={t("tk.singleInOutAria")} checked={v.singleInOutMultiShift} onCheckedChange={(b) => set("singleInOutMultiShift", b)} />} />
        <SettingRow title={t("tk.auto")} description={t("tk.autoHint")}
          control={<SettingSwitch aria-label={t("tk.auto")} checked={v.autoTimekeeping} onCheckedChange={(b) => set("autoTimekeeping", b)} />} />
        <SettingRow title={t("attendance.unscheduled")}
          description={t("tk.unscheduledHint")}
          control={<SettingSwitch aria-label={t("attendance.unscheduled")} checked={v.allowUnscheduled} onCheckedChange={(b) => set("allowUnscheduled", b)} />} />
      </SettingsCard>
      <SaveBar dirty={!!form} pending={save.isPending} onSave={() => save.mutate(v, { onSuccess: () => setForm(null) })} />
      {shiftsOpen && <ShiftFormDialog onClose={() => setShiftsOpen(false)} />}
    </SettingsPage>
  );
}
