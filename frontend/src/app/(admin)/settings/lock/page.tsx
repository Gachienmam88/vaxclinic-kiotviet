"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SettingSwitch } from "@/features/settings/setting-switch";
import { SettingsCard, SettingsPage } from "@/features/settings/settings-shell";
import { useBranches, useSaveSettings, useShopSettings, type LockSettings } from "@/features/settings/settings-queries";
import { useCurrentUser } from "@/lib/use-current-user";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { settingsNs } from "@/messages/settings";
import { DatePicker } from "@/components/ui/date-picker";

/** Ngày hôm qua theo giờ máy (yyyy-MM-dd) — ngày khóa mặc định khi bật khóa sổ cho 1 chi nhánh. */
function yesterday() {
  const d = new Date(Date.now() - 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Thiết lập → Khóa sổ. Chứng từ có ngày ≤ ngày khóa của chi nhánh (hóa đơn, trả hàng, phiếu thu chi, nhập hàng,
 * trả hàng nhập) không được tạo / sửa / hủy — để số liệu báo cáo kỳ đã chốt không bị thay đổi.
 */
export default function BookLockPage() {
  const { data } = useShopSettings();
  const { data: branches = [] } = useBranches();
  const { can } = useCurrentUser();
  const t = useT(settingsNs);
  const tc = useT(commonNs);
  const save = useSaveSettings<LockSettings>("lock");
  const [q, setQ] = useState("");
  if (!data) return <div className="p-6 text-[13px] text-muted-foreground">{tc("status.loading")}</div>;
  const lock = data.lock;
  const map = lock.branches ?? {};
  const readOnly = !can("settings.manage") || save.isPending;
  const set = (patch: Partial<LockSettings>) => save.mutate({ ...lock, branches: map, ...patch });
  const setBranch = (id: string, date: string | null) => {
    const next = { ...map };
    if (date) next[id] = date; else delete next[id];
    set({ branches: next });
  };
  const allOn = branches.length > 0 && branches.every((b) => map[b.id]);
  const shown = branches.filter((b) => b.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <SettingsPage toc={[{ id: "lock", label: t("lock.title") }]}>
      <SettingsCard id="lock" title={t("lock.title")}
        description={t("lock.description")}
        action={<SettingSwitch checked={lock.enabled} disabled={readOnly} onCheckedChange={(v) => set({ enabled: v })} />}>
        {lock.enabled && (
          <div className="space-y-3 p-5">
            <div className="flex items-center gap-3">
              <div className="relative w-80">
                <Search className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
                <Input className="pl-8" placeholder={t("lock.searchBranch")} value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <label className="ml-auto flex items-center gap-2 text-[13px]">{t("lock.enableAll")}
                <SettingSwitch checked={allOn} disabled={readOnly} onCheckedChange={(v) => set({
                  branches: v ? Object.fromEntries(branches.map((b) => [b.id, map[b.id] ?? yesterday()])) : {},
                })} />
              </label>
            </div>
            <table className="w-full text-[13px]">
              <thead className="bg-[#f0f2f5] text-left text-xs [&_th]:h-[34px] [&_th]:font-semibold">
                <tr><th className="px-3 py-2">{t("lock.colBranch")}</th><th className="w-48 px-3">{t("lock.colDate")}</th><th className="w-20 px-3">{t("common.actions")}</th></tr>
              </thead>
              <tbody>
                {shown.map((b) => (
                  <tr key={b.id} className="border-b">
                    <td className="px-3 py-2">{b.name}</td>
                    <td className="px-3">
                      <DatePicker className="h-8" max={yesterday()} disabled={readOnly || !map[b.id]} value={map[b.id] ?? ""}
                        onChange={(v) => v && setBranch(b.id, v)} />
                    </td>
                    <td className="px-3"><SettingSwitch checked={Boolean(map[b.id])} disabled={readOnly}
                      onCheckedChange={(v) => setBranch(b.id, v ? yesterday() : null)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SettingsCard>
    </SettingsPage>
  );
}
