"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SECTORS } from "@/features/accounting/tax-calc";
import { TaxProfileCard } from "@/features/accounting/tax-profile-card";
import { useSaveTax, useTaxSettings, type TaxSettings } from "@/features/accounting/tax-queries";
import { NativeSelect } from "@/features/products/product-form-sections";
import { useTaxRates } from "@/features/products/product-queries";
import { SettingsCard, SettingsPage } from "@/features/settings/settings-shell";
import { useCurrentUser } from "@/lib/use-current-user";

/** "Xem chi tiết" thuế VAT: ngành nghề (quyết định tỷ lệ % GTGT và TNCN trên doanh thu), mã thuế mặc định. */
function VatDialog({ tax, onSave, onClose }: { tax: TaxSettings; onSave: (t: TaxSettings) => void; onClose: () => void }) {
  const { data: rates = [] } = useTaxRates();
  const [f, setF] = useState(tax);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Thiết lập thuế — phương pháp trực tiếp trên doanh thu</DialogTitle></DialogHeader>
        <div className="grid gap-3 text-sm">
          <div className="grid gap-1.5"><Label>Ngành nghề kinh doanh</Label>
            <NativeSelect value={f.sector} onChange={(e) => {
              const s = SECTORS[e.target.value];
              setF({ ...f, sector: e.target.value, vatRate: s.vat, pitRate: s.pit });
            }}>{Object.entries(SECTORS).map(([k, s]) => <option key={k} value={k}>{s.label} (GTGT {s.vat}%, TNCN {s.pit}%)</option>)}</NativeSelect></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Tỷ lệ GTGT (%)</Label><Input type="number" step="0.1" value={f.vatRate} onChange={(e) => setF({ ...f, vatRate: Number(e.target.value) })} /></div>
            <div className="grid gap-1.5"><Label>Tỷ lệ TNCN trên doanh thu (%)</Label><Input type="number" step="0.1" value={f.pitRate} onChange={(e) => setF({ ...f, pitRate: Number(e.target.value) })} /></div>
          </div>
          <div className="grid gap-1.5"><Label>Thuế suất mặc định của hàng hóa chưa chọn thuế</Label>
            <NativeSelect value={f.defaultTaxCode ?? ""} onChange={(e) => setF({ ...f, defaultTaxCode: e.target.value || null })}>
              {rates.map((r) => <option key={r.id} value={r.code}>{r.name}</option>)}</NativeSelect></div>
          <p className="text-xs text-muted-foreground">Hàng có thuế suất KCT / KKKNT không tính GTGT. Vắc xin, dịch vụ y tế thường thuộc diện không chịu thuế GTGT — hãy xác nhận với kế toán.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy bỏ</Button>
          <Button onClick={() => onSave(f)}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Thiết lập → Thuế & Kế toán: thuế VAT + hồ sơ kê khai theo mã số thuế. */
export default function TaxSettingsPage() {
  const { data: tax } = useTaxSettings();
  const { can } = useCurrentUser();
  const save = useSaveTax();
  const [vatDialog, setVatDialog] = useState(false);
  if (!tax) return <div className="p-6 text-sm text-muted-foreground">Đang tải...</div>;
  const readOnly = !can("settings.manage") || save.isPending;
  const update = (patch: Partial<TaxSettings>) => save.mutate({ ...tax, ...patch });
  const addTaxCode = () => {
    const code = prompt("Nhập mã số thuế (10 hoặc 13 chữ số):")?.trim();
    if (code) update({ profiles: [...tax.profiles, { taxCode: code, name: null, revenueGroup: 2, pitMethod: "REVENUE", active: true, locations: [] }] });
  };

  return (
    <SettingsPage toc={[{ id: "vat", label: "Thuế" }, { id: "profiles", label: "Hồ sơ kê khai" }]}>
      <SettingsCard id="vat" title="Thuế">
        <div className="space-y-2 px-5 py-3 text-sm">
          <div className="flex items-center gap-4">
            <div className="flex-1"><p className="font-medium">Thuế VAT</p>
              <p className="text-muted-foreground">Thiết lập phương pháp tính thuế, thuế suất mặc định và tỷ lệ theo ngành nghề.</p></div>
            <Switch checked={tax.vatEnabled} disabled={readOnly} onCheckedChange={(v) => update({ vatEnabled: v })} />
          </div>
          <div className="flex items-center gap-4 pl-4">
            <div className="flex-1"><p className="font-medium">Phương pháp trực tiếp</p>
              <p className="text-muted-foreground">{SECTORS[tax.sector]?.label}: {tax.vatRate}% GTGT, {tax.pitRate}% TNCN trên doanh thu.
                Thuế suất mặc định: {tax.defaultTaxCode ?? "chưa chọn"}.</p></div>
            <Button variant="outline" disabled={readOnly} onClick={() => setVatDialog(true)}>Xem chi tiết</Button>
          </div>
        </div>
      </SettingsCard>
      <SettingsCard id="profiles" title="Hồ sơ kê khai"
        action={!readOnly && <Button variant="outline" size="sm" onClick={addTaxCode}><Plus className="size-4" /> Thêm mã số thuế</Button>}>
        <div className="space-y-3 p-4">
          {!tax.profiles.length && <p className="text-sm text-muted-foreground">Chưa có mã số thuế. Bấm "Thêm mã số thuế" để bắt đầu.</p>}
          {tax.profiles.map((p, i) => (
            <TaxProfileCard key={p.taxCode} profile={p} readOnly={readOnly}
              onChange={(np) => update({ profiles: tax.profiles.map((x, j) => (j === i ? np : x)) })}
              onDelete={() => update({ profiles: tax.profiles.filter((_, j) => j !== i) })} />
          ))}
        </div>
      </SettingsCard>
      {vatDialog && <VatDialog tax={tax} onClose={() => setVatDialog(false)} onSave={(t) => { save.mutate(t); setVatDialog(false); }} />}
    </SettingsPage>
  );
}
