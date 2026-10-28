"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { SalesChannelSettings } from "@/features/settings/sales-channel-settings";
import { SettingSwitch } from "@/features/settings/setting-switch";
import { SettingRow, SettingsCard, SettingsPage } from "@/features/settings/settings-shell";
import { useSaveSettings, useShopSettings, type SalesSettings } from "@/features/settings/settings-queries";
import { useCurrentUser } from "@/lib/use-current-user";

/** Thiết lập → Đơn hàng. Mọi quy tắc ở đây được backend áp dụng (sales-service, product-service). */
export default function OrderSettingsPage() {
  const { data } = useShopSettings();
  const { can } = useCurrentUser();
  const save = useSaveSettings<SalesSettings>("sales");
  const [days, setDays] = useState<string | null>(null);
  if (!data) return <div className="p-6 text-[13px] text-muted-foreground">Đang tải...</div>;
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
    <SettingsPage toc={[{ id: "orders", label: "Quản lý đơn hàng" }, { id: "channels", label: "Kênh bán" }, { id: "codes", label: "Mã giao dịch" }]}>
      <SettingsCard id="orders" title="Quản lý đơn hàng">
        <SettingRow title="Cho phép giao dịch khi hết tồn kho" control={toggle("allowNegativeStock")}
          description={<>Dù không đủ tồn kho vẫn bán hàng, trả hàng nhập được; tồn âm sẽ được bù khi nhập hàng.
            <br />Lưu ý: không áp dụng cho hàng quản lý theo lô, hạn sử dụng (vắc xin luôn phải đủ lô còn hạn).</>} />
        <SettingRow title="Giới hạn thời gian trả hàng" description="Chỉ nhận trả hàng trong số ngày nhất định kể từ ngày bán."
          control={<SettingSwitch checked={s.returnLimitDays != null} disabled={readOnly}
            onCheckedChange={(v) => set({ returnLimitDays: v ? Number(daysValue) || 7 : null })} />}>
          {s.returnLimitDays != null && (
            <div className="mt-2 flex items-center gap-2 text-[13px]">
              Cho phép trả hàng trong
              <Input className="h-8 w-20 text-right" type="number" min={1} value={daysValue} disabled={readOnly}
                onChange={(e) => setDays(e.target.value)} onBlur={saveDays} onKeyDown={(e) => e.key === "Enter" && saveDays()} />
              ngày kể từ ngày bán
            </div>
          )}
        </SettingRow>
        <SettingRow title="Không cho phép thay đổi thời gian giao dịch" control={toggle("lockTransactionTime")}
          description="Khi bật, không ai sửa được thời gian bán của hóa đơn đã tạo." />
        <SettingRow title="Chặn chỉnh sửa/hủy hóa đơn đã phát hành HĐĐT" control={toggle("blockEditPublishedEInvoice")}
          description="Khi bật, hệ thống không cho chỉnh sửa hoặc hủy các hóa đơn đã phát hành hóa đơn điện tử." />
      </SettingsCard>
      <SalesChannelSettings />
      <SettingsCard id="codes" title="Mã giao dịch">
        <SettingRow title="Quy tắc tạo mã giao dịch"
          description="Hệ thống tự động tạo mã cho hóa đơn, phiếu trả hàng, phiếu thu chi theo thứ tự phát sinh.">
          <div className="mt-2 rounded-md bg-muted/50 p-3 text-[13px]">
            <p className="font-medium">Tăng dần theo thứ tự tạo giao dịch</p>
            <p className="mt-1 text-muted-foreground">Ví dụ: <b>HD000001 → HD000002 → HD000003</b> · Trả hàng: TH000001 · Phiếu thu: PT000001 · Phiếu chi: PC000001</p>
          </div>
        </SettingRow>
      </SettingsCard>
    </SettingsPage>
  );
}
