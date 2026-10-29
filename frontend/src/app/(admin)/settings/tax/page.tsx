"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingSwitch } from "@/features/settings/setting-switch";
import { TaxProfileCard } from "@/features/accounting/tax-profile-card";
import { useSaveTax, useTaxSettings, type TaxSettings } from "@/features/accounting/tax-queries";
import { TaxSectorDialog } from "@/features/accounting/tax-sector-editor";
import { SettingsCard, SettingsPage } from "@/features/settings/settings-shell";
import { useCurrentUser } from "@/lib/use-current-user";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { settingsNs } from "@/messages/settings";

/** Thiết lập → Thuế & Kế toán: thuế VAT + hồ sơ kê khai theo mã số thuế. */
export default function TaxSettingsPage() {
  const { data: tax } = useTaxSettings();
  const { can } = useCurrentUser();
  const t = useT(settingsNs);
  const tc = useT(commonNs);
  const save = useSaveTax();
  const [vatDialog, setVatDialog] = useState(false);
  if (!tax) return <div className="p-6 text-[13px] text-muted-foreground">{tc("status.loading")}</div>;
  const readOnly = !can("settings.manage") || save.isPending;
  const update = (patch: Partial<TaxSettings>) => save.mutate({ ...tax, ...patch });
  const addTaxCode = () => {
    const code = prompt(t("tax.promptTaxCode"))?.trim();
    if (code) update({ profiles: [...tax.profiles, { taxCode: code, name: null, revenueGroup: 2, pitMethod: "REVENUE", active: true, locations: [] }] });
  };

  return (
    <SettingsPage toc={[{ id: "vat", label: t("tax.tocVat") }, { id: "profiles", label: t("tax.tocProfiles") }]}>
      <SettingsCard id="vat" title={t("tax.tocVat")}>
        <div className="space-y-2 px-5 py-3.5 text-[13px] leading-5">
          <div className="flex items-center gap-4">
            <div className="flex-1"><p className="font-medium">{t("tax.vat")}</p>
              <p className="text-muted-foreground">{t("tax.vatDesc")}</p></div>
            <SettingSwitch checked={tax.vatEnabled} disabled={readOnly} onCheckedChange={(v) => update({ vatEnabled: v })} />
          </div>
          <div className="flex items-center gap-4 pl-5" role="radiogroup" aria-label={t("tax.vatMethod")}>
            <div className="flex-1"><p className="font-medium">{t("tax.vatMethod")}</p>
              <p className="text-muted-foreground">{t("tax.vatMethodDesc")}</p></div>
            {(["DEDUCTION", "DIRECT"] as const).map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-1.5">
                <input type="radio" name="vat-method" className="size-4 accent-primary" disabled={readOnly}
                  checked={(tax.vatMethod ?? "DEDUCTION") === m} onChange={() => update({ vatMethod: m })} />{t(`tax.vatMethods.${m}`)}
              </label>))}
          </div>
          <div className="flex items-start gap-4 pl-5">
            <div className="flex-1"><p className="font-medium">{t("tax.directMethod")}</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {tax.sectors.map((s) => (
                  <li key={s.code}>{t("tax.sectorRates", { name: s.name, vat: s.vatRate, pit: s.pitRate })}
                    {s.code === tax.defaultSector && <span className="ml-1 text-primary">{t("tax.default")}</span>}
                    {" — "}{t("tax.sectorCategories", { count: Object.values(tax.categorySectors).filter((c) => c === s.code).length })}</li>
                ))}
              </ul>
              <p className="text-muted-foreground">{t("tax.defaultTaxCode", { code: tax.defaultTaxCode ?? t("tax.notChosen") })}</p></div>
            <Button variant="outline" disabled={readOnly} onClick={() => setVatDialog(true)}>{tc("actions.viewDetail")}</Button>
          </div>
        </div>
      </SettingsCard>
      <SettingsCard id="profiles" title={t("tax.tocProfiles")}
        action={!readOnly && <Button variant="outline" size="sm" onClick={addTaxCode}><Plus className="size-4" /> {t("tax.addTaxCode")}</Button>}>
        <div className="space-y-3 p-4">
          {!tax.profiles.length && <p className="text-[13px] text-muted-foreground">{t("tax.noProfiles")}</p>}
          {tax.profiles.map((p, i) => (
            <TaxProfileCard key={p.taxCode} profile={p} readOnly={readOnly}
              onChange={(np) => update({ profiles: tax.profiles.map((x, j) => (j === i ? np : x)) })}
              onDelete={() => update({ profiles: tax.profiles.filter((_, j) => j !== i) })} />
          ))}
        </div>
      </SettingsCard>
      {vatDialog && <TaxSectorDialog tax={tax} onClose={() => setVatDialog(false)} onSave={(next) => { save.mutate(next); setVatDialog(false); }} />}
    </SettingsPage>
  );
}
