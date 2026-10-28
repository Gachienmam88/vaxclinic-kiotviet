"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { SalesChannelSettings } from "@/features/settings/sales-channel-settings";
import { SettingSwitch } from "@/features/settings/setting-switch";
import { SettingRow, SettingsCard, SettingsPage } from "@/features/settings/settings-shell";
import { useSaveSettings, useShopSettings, type SalesSettings } from "@/features/settings/settings-queries";
import { useCurrentUser } from "@/lib/use-current-user";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { settingsNs } from "@/messages/settings";

/** Thiết lập → Đơn hàng. Mọi quy tắc ở đây được backend áp dụng (sales-service, product-service). */
export default function OrderSettingsPage() {
  const { data } = useShopSettings();
  const { can } = useCurrentUser();
  const t = useT(settingsNs);
  const tc = useT(commonNs);
  const save = useSaveSettings<SalesSettings>("sales");
  const [days, setDays] = useState<string | null>(null);
  if (!data) return <div className="p-6 text-[13px] text-muted-foreground">{tc("status.loading")}</div>;
  const s = data.sales;
  const readOnly = !can("settings.manage") || save.isPending;
  const set = (patch: Partial<SalesSettings>) => save.mutate({ ...s, ...patch });
  const toggle = (key: keyof SalesSettings) => (
    <SettingSwitch checked={Boolean(s[key])} disabled={readOnly} onCheckedChange={(v) => set({ [key]: v })} />
  );
  const daysValue = days ?? String(s.returnLimitDays ?? 7);
  const saveDays = () => {
    const n = Number(daysValue);
    if (Number.isInteger(n) && n >= 1 && n !== s.returnLimitDays) set({ returnLimitDays: n });
  };

  return (
    <SettingsPage toc={[{ id: "orders", label: t("orders.tocOrders") }, { id: "channels", label: t("orders.tocChannels") }, { id: "codes", label: t("orders.tocCodes") }]}>
      <SettingsCard id="orders" title={t("orders.tocOrders")}>
        <SettingRow title={t("orders.allowNegative")} control={toggle("allowNegativeStock")}
          description={<>{t("orders.allowNegativeDesc")}<br />{t("orders.allowNegativeNote")}</>} />
        <SettingRow title={t("orders.returnLimit")} description={t("orders.returnLimitDesc")}
          control={<SettingSwitch checked={s.returnLimitDays != null} disabled={readOnly}
            onCheckedChange={(v) => set({ returnLimitDays: v ? Number(daysValue) || 7 : null })} />}>
          {s.returnLimitDays != null && (
            <div className="mt-2 flex items-center gap-2 text-[13px]">
              {t("orders.returnLimitBefore")}
              <Input className="h-8 w-20 text-right" type="number" min={1} value={daysValue} disabled={readOnly}
                onChange={(e) => setDays(e.target.value)} onBlur={saveDays} onKeyDown={(e) => e.key === "Enter" && saveDays()} />
              {t("orders.returnLimitAfter")}
            </div>
          )}
        </SettingRow>
        <SettingRow title={t("orders.lockTime")} control={toggle("lockTransactionTime")}
          description={t("orders.lockTimeDesc")} />
        <SettingRow title={t("orders.blockEInvoice")} control={toggle("blockEditPublishedEInvoice")}
          description={t("orders.blockEInvoiceDesc")} />
      </SettingsCard>
      <SalesChannelSettings />
      <SettingsCard id="codes" title={t("orders.tocCodes")}>
        <SettingRow title={t("orders.codeRule")}
          description={t("orders.codeRuleDesc")}>
          <div className="mt-2 rounded-md bg-muted/50 p-3 text-[13px]">
            <p className="font-medium">{t("orders.codeRuleValue")}</p>
            <p className="mt-1 text-muted-foreground">{t("orders.codeRuleExample")} <b>HD000001 → HD000002 → HD000003</b> · {t("orders.codeRuleOthers")}</p>
          </div>
        </SettingRow>
      </SettingsCard>
    </SettingsPage>
  );
}
