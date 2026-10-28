"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { SettingSwitch } from "@/features/settings/setting-switch";
import { SettingRow, SettingsCard, SettingsPage } from "@/features/settings/settings-shell";
import { CUSTOMER_FIELDS, useSaveSettings, useShopSettings, type CustomerSettings } from "@/features/settings/settings-queries";
import { formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";

/** Thứ tự hiển thị 2 cột giống KiotViet (cột trái: SĐT, Email, Giới tính; cột phải: Ngày sinh, Địa chỉ, Facebook, Nhóm). */
const FIELD_ORDER = ["phone", "email", "gender", "birthday", "address", "facebook", "group"] as const;

/** Thiết lập → Khách hàng. */
export default function CustomerSettingsPage() {
  const { data } = useShopSettings();
  const { can } = useCurrentUser();
  const save = useSaveSettings<CustomerSettings>("customer");
  const [limit, setLimit] = useState<string | null>(null);
  if (!data) return <div className="p-6 text-[13px] text-muted-foreground">Đang tải...</div>;
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
          control={<SettingSwitch checked={c.debtLimit != null} disabled={readOnly}
            onCheckedChange={(v) => set({ debtLimit: v ? Number(limitValue.replace(/\D/g, "")) || 0 : null })} />}>
          {c.debtLimit != null && (
            <div className="mt-2 flex items-center gap-2 text-[13px]">
              Cảnh báo khi nợ vượt
              <Input className="h-8 w-36 text-right" inputMode="numeric" disabled={readOnly}
                value={formatNumber(Number(limitValue.replace(/\D/g, "")) || 0)}
                onChange={(e) => setLimit(e.target.value)} onBlur={saveLimit} onKeyDown={(e) => e.key === "Enter" && saveLimit()} />
              đồng
            </div>
          )}
        </SettingRow>
        <SettingRow title="Thiết lập thông tin bắt buộc" description="Thiết lập tính bắt buộc cho các trường thông tin khách hàng.">
          <div className="mt-4 grid grid-cols-1 gap-x-10 gap-y-2.5 px-5 pb-1 text-[13px] md:grid-flow-col md:grid-cols-2 md:grid-rows-4 md:[&>label:nth-child(-n+4)]:border-r md:[&>label:nth-child(-n+4)]:pr-5">
            <label className="flex items-center justify-between">Tên khách hàng <SettingSwitch checked disabled /></label>
            {FIELD_ORDER.map((key) => [key, CUSTOMER_FIELDS.find(([k]) => k === key)![1]] as const).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between">{label}
                <SettingSwitch checked={required(key)} disabled={readOnly} onCheckedChange={(v) => set({
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
