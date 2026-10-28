"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SettingRow, SettingsCard, SettingsPage } from "@/features/settings/settings-shell";
import { useSaveSettings, useShopSettings, type CustomerSettings } from "@/features/settings/settings-queries";
import { formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";

/** Trường có thể đặt bắt buộc — khớp với SettingsController.CUSTOMER_FIELDS phía identity-service. */
export const CUSTOMER_FIELDS = [
  ["phone", "Số điện thoại"], ["birthday", "Ngày sinh"], ["email", "Email"], ["address", "Địa chỉ"],
  ["gender", "Giới tính"], ["facebook", "Facebook"], ["group", "Nhóm khách hàng"],
] as const;

/** Thiết lập → Khách hàng. */
export default function CustomerSettingsPage() {
  const { data } = useShopSettings();
  const { can } = useCurrentUser();
  const save = useSaveSettings<CustomerSettings>("customer");
  const [limit, setLimit] = useState<string | null>(null);
  if (!data) return <div className="p-6 text-sm text-muted-foreground">Đang tải...</div>;
  const c = data.customer;
  const readOnly = !can("settings.manage") || save.isPending;
  const set = (patch: Partial<CustomerSettings>) => save.mutate({ ...c, ...patch });
  const limitValue = limit ?? String(c.debtLimit ?? 0);
  const saveLimit = () => {
    const n = Number(limitValue.replace(/\D/g, ""));
    if (n !== Number(c.debtLimit)) set({ debtLimit: n });
  };
  const required = (f: string) => c.requiredFields.includes(f);

  return (
    <SettingsPage toc={[{ id: "customers", label: "Quản lý khách hàng" }]}>
      <SettingsCard id="customers" title="Quản lý khách hàng">
        <SettingRow title="Cảnh báo công nợ khách hàng" description="Hiển thị cảnh báo ở màn bán hàng khi khách hàng nợ vượt mức."
          control={<Switch checked={c.debtLimit != null} disabled={readOnly}
            onCheckedChange={(v) => set({ debtLimit: v ? Number(limitValue.replace(/\D/g, "")) || 0 : null })} />}>
          {c.debtLimit != null && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              Cảnh báo khi nợ vượt
              <Input className="h-8 w-36 text-right" inputMode="numeric" disabled={readOnly}
                value={formatNumber(Number(limitValue.replace(/\D/g, "")) || 0)}
                onChange={(e) => setLimit(e.target.value)} onBlur={saveLimit} onKeyDown={(e) => e.key === "Enter" && saveLimit()} />
              đồng
            </div>
          )}
        </SettingRow>
        <SettingRow title="Thiết lập thông tin bắt buộc" description="Thiết lập tính bắt buộc cho các trường thông tin khách hàng.">
          <div className="mt-3 grid grid-cols-1 gap-x-10 gap-y-2.5 px-4 text-sm md:grid-cols-2">
            <label className="flex items-center justify-between">Tên khách hàng <Switch checked disabled /></label>
            {CUSTOMER_FIELDS.map(([key, label]) => (
              <label key={key} className="flex items-center justify-between">{label}
                <Switch checked={required(key)} disabled={readOnly} onCheckedChange={(v) => set({
                  requiredFields: v ? [...c.requiredFields, key] : c.requiredFields.filter((f) => f !== key),
                })} />
              </label>
            ))}
          </div>
        </SettingRow>
      </SettingsCard>
    </SettingsPage>
  );
}
