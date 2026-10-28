"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingSwitch } from "@/features/settings/setting-switch";
import { NativeSelect } from "@/features/products/product-form-sections";
import { useBranches } from "@/features/settings/settings-queries";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { accountingNs } from "@/messages/accounting";
import { groupLabel, REVENUE_GROUPS } from "./accounting-labels";
import { TaxLocationDialog } from "./tax-location-dialog";
import type { TaxLocation, TaxProfile } from "./tax-queries";

/** Hồ sơ kê khai của 1 MST: bật/tắt, nhóm doanh thu, cách tính TNCN, danh sách địa điểm kinh doanh. */
export function TaxProfileCard({ profile, readOnly, onChange, onDelete }: {
  profile: TaxProfile; readOnly: boolean; onChange: (p: TaxProfile) => void; onDelete: () => void;
}) {
  const t = useT(accountingNs);
  const { data: branches = [] } = useBranches();
  const [open, setOpen] = useState(true);
  const [dialog, setDialog] = useState<{ index?: number } | null>(null);
  const set = (patch: Partial<TaxProfile>) => onChange({ ...profile, ...patch });
  const saveLocation = (l: TaxLocation) => {
    const list = [...profile.locations];
    if (dialog?.index === undefined) list.push(l); else list[dialog.index] = l;
    set({ locations: list });
    setDialog(null);
  };
  const toggleLocation = (i: number, active: boolean) => {
    if (!active && !confirm(t("profile.confirmDeactivate"))) return;
    set({ locations: profile.locations.map((l, j) => (j === i ? { ...l, active } : l)) });
  };

  return (
    <div className="rounded-lg border border-primary/70">
      <button type="button" className="flex w-full items-center gap-2 px-4 py-3" onClick={() => setOpen(!open)}>
        <span className="text-[15px] font-semibold text-primary">{profile.taxCode}</span>
        <span className={profile.active ? "rounded bg-primary-tint px-1 py-0.5 text-[11px] text-primary" : "rounded bg-muted px-1 py-0.5 text-[11px] text-muted-foreground"}>
          {t(profile.active ? "profile.declaring" : "profile.notDeclaring")}</span>
        {open ? <ChevronUp className="ml-auto size-4" /> : <ChevronDown className="ml-auto size-4" />}
      </button>
      {open && (
        <div className="space-y-4 px-5 pb-4 text-[13px]">
          <div className="flex items-center gap-4">
            <div className="flex-1"><p className="font-medium">{t("profile.manageTitle")}</p>
              <p className="text-muted-foreground">{t("profile.manageDesc")}</p></div>
            <SettingSwitch checked={profile.active} disabled={readOnly} onCheckedChange={(v) => set({ active: v })} />
          </div>
          <div className="grid grid-cols-[12rem_1fr] items-center gap-3 border-t pt-3">
            <span>{t("profile.revenueGroup")}</span>
            <div className="w-64"><NativeSelect value={profile.revenueGroup} disabled={readOnly}
              onChange={(e) => set({ revenueGroup: Number(e.target.value) })}>
              {REVENUE_GROUPS.map((g) => <option key={g} value={g}>{groupLabel(t, g)}</option>)}</NativeSelect></div>
            <span>{t("profile.pitMethod")}</span>
            <div className="flex gap-4">
              {([["REVENUE", "profile.pitRevenue"], ["PROFIT", "profile.pitProfit"]] as const).map(([v, label]) => (
                <label key={v} className="flex items-center gap-1.5">
                  <input type="radio" className="accent-primary" disabled={readOnly || profile.revenueGroup === 1}
                    checked={profile.pitMethod === v} onChange={() => set({ pitMethod: v })} />{t(label)}</label>
              ))}
            </div>
          </div>
          <div className="border-t pt-3">
            <div className="mb-2 flex items-center"><b className="font-semibold">{t("profile.locations")}</b>
              {!readOnly && <Button variant="outline" size="sm" className="ml-auto" onClick={() => setDialog({})}><Plus className="size-4" /> {t("profile.addLocation")}</Button>}</div>
            <table className="w-full">
              <thead className="bg-[#f0f2f5] text-left text-xs"><tr><th className="h-[34px] px-2 font-semibold">{t("profile.colCode")}</th><th className="px-2">{t("profile.colName")}</th><th className="px-2">{t("profile.colAddress")}</th>
                <th className="px-2">{t("profile.colBranches")}</th><th className="px-2">{t("profile.colStartDate")}</th><th className="px-2">{t("profile.colStatus")}</th><th className="w-12 px-2" /></tr></thead>
              <tbody>
                {!profile.locations.length && <tr><td colSpan={7} className="py-4 text-center text-muted-foreground">{t("profile.noLocations")}</td></tr>}
                {profile.locations.map((l, i) => (
                  <tr key={l.code} className="border-b">
                    <td className="px-2 py-2">{l.code}</td>
                    <td className="px-2"><span className="flex items-center gap-1 text-green-700"><MapPin className="size-3.5" />{l.name}</span></td>
                    <td className="px-2">{[l.address, l.ward, l.province].filter(Boolean).join(", ")}</td>
                    <td className="px-2">{l.branchIds.map((id) => branches.find((b) => b.id === id)?.name).filter(Boolean).join(", ")}</td>
                    <td className="px-2">{formatDate(l.startDate)}</td>
                    <td className="px-2"><SettingSwitch checked={l.active} disabled={readOnly} onCheckedChange={(v) => toggleLocation(i, v)} /></td>
                    <td className="px-2">{!readOnly && <Button size="icon-sm" variant="outline" aria-label={t("profile.editLocation")} title={t("profile.editLocation")} onClick={() => setDialog({ index: i })}><Pencil className="size-4" /></Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readOnly && (
            <div className="flex items-center border-t pt-3">
              <div className="flex-1"><p className="font-medium">{t("profile.deleteTitle")}</p>
                <p className="text-muted-foreground">{t("profile.deleteDesc", { code: profile.taxCode })}</p></div>
              <Button variant="outline" onClick={() => confirm(t("profile.confirmDelete", { code: profile.taxCode })) && onDelete()}><Trash2 className="size-4" /> {t("profile.deleteTitle")}</Button>
            </div>
          )}
        </div>
      )}
      {dialog && (
        <TaxLocationDialog location={dialog.index === undefined ? undefined : profile.locations[dialog.index]}
          nextCode={String(profile.locations.length + 1).padStart(5, "0")} onSave={saveLocation} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
