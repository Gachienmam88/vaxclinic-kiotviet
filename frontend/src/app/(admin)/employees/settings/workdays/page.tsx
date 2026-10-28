"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { SettingsCard, SettingsPage, SETTINGS_TABLE } from "@/features/settings/settings-layout-parts";
import { useBranches } from "@/features/settings/settings-queries";
import { HolidayDialog } from "@/features/hr/holiday-dialog";
import { dmy, parseIso, useHrSettings, useSaveHrSetting } from "@/features/hr/hr-queries";
import { WEEKDAY_SHORT, type Holiday } from "@/features/hr/hr-types";
import { WorkdaysBranchDialog } from "@/features/hr/workdays-branch-dialog";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { hrNs } from "@/messages/hr";

const ALL = [1, 2, 3, 4, 5, 6, 7];
const days = (h: Holiday) => Math.round((parseIso(h.to).getTime() - parseIso(h.from).getTime()) / 86_400_000) + 1;

/** Ngày làm & Nghỉ (ảnh KiotViet 121): ngày làm việc trong tuần từng chi nhánh, kỳ lễ tết + hệ số lương. */
export default function WorkdaysSettingsPage() {
  const t = useT(hrNs);
  const tc = useT(commonNs);
  const { data } = useHrSettings();
  const { data: branches = [] } = useBranches();
  const saveWorkdays = useSaveHrSetting("workdays");
  const saveHolidays = useSaveHrSetting("holidays");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(10);
  const [editBranch, setEditBranch] = useState<string | null>(null);
  const [editHoliday, setEditHoliday] = useState<Holiday | "new" | null>(null);
  const workdays = data?.workdays ?? [];
  const holidays = data?.holidays ?? [];
  const daysOf = (branchId: string) => workdays.find((w) => w.branchId === branchId)?.days ?? ALL;
  const shown = branches.filter((b) => b.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, limit);
  const branch = branches.find((b) => b.id === editBranch);

  const storeDays = (branchId: string, d: number[]) => saveWorkdays.mutate(
    [...workdays.filter((w) => w.branchId !== branchId), { branchId, days: [...d].sort((a, b) => a - b) }],
    { onSuccess: () => setEditBranch(null) });
  const storeHoliday = (h: Holiday) => saveHolidays.mutate(
    editHoliday === "new" ? [...holidays, h] : holidays.map((x) => (x.id === h.id ? h : x)),
    { onSuccess: () => setEditHoliday(null) });

  return (
    <SettingsPage toc={[{ id: "ngay-lam-viec", label: t("wd.workdays") }, { id: "ngay-le-tet", label: t("wd.holidays") }]}>
      <SettingsCard id="ngay-lam-viec" title={t("wd.workdays")} description={t("wd.workdaysHint")}>
        <div className="px-4 py-2.5">
          <table className={SETTINGS_TABLE.table}>
            <thead className={SETTINGS_TABLE.head}><tr><th className="w-14 text-center">{t("wd.no")}</th><th>{t("employee.branches")}</th>
              <th>{t("wd.workdays")}</th><th>{tc("fields.status")}</th><th className="w-10" /></tr></thead>
            <tbody>
              <tr><td /><td className="py-1.5 pr-2"><input aria-label={t("wd.searchBranch")} placeholder={t("wd.searchBranch")} value={q} onChange={(e) => setQ(e.target.value)}
                className="h-[30px] w-full max-w-[200px] rounded-md border border-[#d9dbe0] px-2 text-[12px] outline-none focus:border-primary" /></td><td colSpan={3} /></tr>
              {!shown.length && <tr><td colSpan={5} className={SETTINGS_TABLE.empty}>{t("commissionGrid.noResults")}</td></tr>}
              {shown.map((b, i) => (
                <tr key={b.id} className="border-b border-[#eceef1] [&_td]:px-2 [&_td]:py-3">
                  <td className="text-center">{i + 1}</td><td>{b.name}</td>
                  <td>{daysOf(b.id).map((d) => t(WEEKDAY_SHORT[d - 1])).join(", ")}</td>
                  <td>{b.active ? tc("status.active") : tc("status.inactive")}</td>
                  <td><button type="button" aria-label={t("wd.editAria", { name: b.name })} onClick={() => setEditBranch(b.id)}>
                    <Pencil className="size-3.5 hover:text-primary" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-2 pt-2.5 text-[12px]">{tc("pager.perPage")}
            <select aria-label={t("wd.rows")} className="h-6 rounded border border-[#d9dbe0] px-1" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              {[10, 20, 50].map((n) => <option key={n} value={n}>{t("wd.rowsOption", { n })}</option>)}
            </select>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard id="ngay-le-tet" title={t("wd.holidays")} description={t("wd.holidaysHint")}
        action={<button type="button" onClick={() => setEditHoliday("new")}
          className="flex h-[30px] items-center gap-1.5 rounded-md border border-[#d9dbe0] px-2.5 text-[12px] font-semibold hover:border-primary hover:text-primary">
          <Plus className="size-4" /> {t("holiday.addTitle")}</button>}>
        <div className="px-4 py-2.5">
          <table className={SETTINGS_TABLE.table}>
            <thead className={SETTINGS_TABLE.head}><tr><th className="w-14 text-center">{t("wd.no")}</th><th>{t("holiday.name")}</th><th>{t("holiday.from")}</th>
              <th>{t("holiday.to")}</th><th>{t("wd.days")}</th><th>{t("holiday.multiplier")}</th><th className="w-14" /></tr></thead>
            <tbody>
              {!holidays.length && <tr><td colSpan={7} className={`${SETTINGS_TABLE.empty} border-b border-[#eceef1]`}>{t("commissionGrid.noResults")}</td></tr>}
              {[...holidays].sort((a, b) => a.from.localeCompare(b.from)).map((h, i) => (
                <tr key={h.id ?? i} className="border-b border-[#eceef1] [&_td]:px-2 [&_td]:py-3">
                  <td className="text-center">{i + 1}</td><td>{h.name}</td><td>{dmy(h.from)}</td><td>{dmy(h.to)}</td>
                  <td>{days(h)}</td><td>{h.multiplier}%</td>
                  <td className="whitespace-nowrap">
                    <button type="button" aria-label={t("commissionSidebar.editAria", { name: h.name })} className="mr-2" onClick={() => setEditHoliday(h)}>
                      <Pencil className="size-3.5 hover:text-primary" /></button>
                    <button type="button" aria-label={t("nameList.remove", { name: h.name })}
                      onClick={() => confirm(t("wd.confirmDeleteHoliday", { name: h.name })) && saveHolidays.mutate(holidays.filter((x) => x !== h))}>
                      <Trash2 className="size-3.5 hover:text-destructive" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsCard>
      {branch && <WorkdaysBranchDialog branchName={branch.name} days={daysOf(branch.id)} pending={saveWorkdays.isPending}
        onSave={(d) => storeDays(branch.id, d)} onClose={() => setEditBranch(null)} />}
      {editHoliday && <HolidayDialog holiday={editHoliday === "new" ? undefined : editHoliday} pending={saveHolidays.isPending}
        onSave={storeHoliday} onClose={() => setEditHoliday(null)} />}
    </SettingsPage>
  );
}
