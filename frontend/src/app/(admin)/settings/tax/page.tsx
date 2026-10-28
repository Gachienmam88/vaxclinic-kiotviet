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

/** Thiết lập → Thuế & Kế toán: thuế VAT + hồ sơ kê khai theo mã số thuế. */
export default function TaxSettingsPage() {
  const { data: tax } = useTaxSettings();
  const { can } = useCurrentUser();
  const save = useSaveTax();
  const [vatDialog, setVatDialog] = useState(false);
  if (!tax) return <div className="p-6 text-[13px] text-muted-foreground">Đang tải...</div>;
  const readOnly = !can("settings.manage") || save.isPending;
  const update = (patch: Partial<TaxSettings>) => save.mutate({ ...tax, ...patch });
  const addTaxCode = () => {
    const code = prompt("Nhập mã số thuế (10 hoặc 13 chữ số):")?.trim();
    if (code) update({ profiles: [...tax.profiles, { taxCode: code, name: null, revenueGroup: 2, pitMethod: "REVENUE", active: true, locations: [] }] });
  };

  return (
    <SettingsPage toc={[{ id: "vat", label: "Thuế" }, { id: "profiles", label: "Hồ sơ kê khai" }]}>
      <SettingsCard id="vat" title="Thuế">
        <div className="space-y-2 px-5 py-3.5 text-[13px] leading-5">
          <div className="flex items-center gap-4">
            <div className="flex-1"><p className="font-medium">Thuế VAT</p>
              <p className="text-muted-foreground">Thiết lập phương pháp tính thuế, thuế suất mặc định và tỷ lệ theo ngành nghề.</p></div>
            <SettingSwitch checked={tax.vatEnabled} disabled={readOnly} onCheckedChange={(v) => update({ vatEnabled: v })} />
          </div>
          <div className="flex items-start gap-4 pl-5">
            <div className="flex-1"><p className="font-medium">Phương pháp trực tiếp — tỷ lệ % trên doanh thu theo ngành nghề</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {tax.sectors.map((s) => (
                  <li key={s.code}>{s.name}: GTGT {s.vatRate}%, TNCN {s.pitRate}%
                    {s.code === tax.defaultSector && <span className="ml-1 text-primary">(mặc định)</span>}
                    {" — "}{Object.values(tax.categorySectors).filter((c) => c === s.code).length} nhóm hàng</li>
                ))}
              </ul>
              <p className="text-muted-foreground">Thuế suất mặc định: {tax.defaultTaxCode ?? "chưa chọn"}.</p></div>
            <Button variant="outline" disabled={readOnly} onClick={() => setVatDialog(true)}>Xem chi tiết</Button>
          </div>
        </div>
      </SettingsCard>
      <SettingsCard id="profiles" title="Hồ sơ kê khai"
        action={!readOnly && <Button variant="outline" size="sm" onClick={addTaxCode}><Plus className="size-4" /> Thêm mã số thuế</Button>}>
        <div className="space-y-3 p-4">
          {!tax.profiles.length && <p className="text-[13px] text-muted-foreground">Chưa có mã số thuế. Bấm &ldquo;Thêm mã số thuế&rdquo; để bắt đầu.</p>}
          {tax.profiles.map((p, i) => (
            <TaxProfileCard key={p.taxCode} profile={p} readOnly={readOnly}
              onChange={(np) => update({ profiles: tax.profiles.map((x, j) => (j === i ? np : x)) })}
              onDelete={() => update({ profiles: tax.profiles.filter((_, j) => j !== i) })} />
          ))}
        </div>
      </SettingsCard>
      {vatDialog && <TaxSectorDialog tax={tax} onClose={() => setVatDialog(false)} onSave={(t) => { save.mutate(t); setVatDialog(false); }} />}
    </SettingsPage>
  );
}
