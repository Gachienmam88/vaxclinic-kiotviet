"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSalesChannels } from "@/features/delivery/delivery-queries";
import type { SalesChannel } from "@/features/delivery/delivery-types";
import { SettingSwitch } from "@/features/settings/setting-switch";
import { SettingsCard } from "@/features/settings/settings-shell";
import { api, errorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";

/**
 * Thiết lập → Đơn hàng → Kênh bán: danh sách kênh chọn ở màn bán hàng (Bán trực tiếp mặc định, không tắt / xóa được).
 * Kênh đã có giao dịch không xóa được — tắt "Hoạt động" để ẩn khỏi màn bán hàng, báo cáo vẫn lọc được.
 */
export function SalesChannelSettings() {
  const qc = useQueryClient();
  const { can } = useCurrentUser();
  const { data = [] } = useSalesChannels(true);
  const [name, setName] = useState("");
  const done = (msg: string) => { toast.success(msg); qc.invalidateQueries({ queryKey: ["sales-channels"] }); };
  const add = useMutation({
    mutationFn: () => api("/sales-channels", { method: "POST", body: { name } }),
    onSuccess: () => { done(`Đã thêm kênh bán ${name}`); setName(""); }, onError: (e) => toast.error(errorMessage(e)),
  });
  const update = useMutation({
    mutationFn: (c: SalesChannel) => api(`/sales-channels/${c.code}`, { method: "PUT", body: { name: c.name, active: c.active } }),
    onSuccess: () => done("Đã cập nhật kênh bán"), onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (code: string) => api(`/sales-channels/${code}`, { method: "DELETE" }),
    onSuccess: () => done("Đã xóa kênh bán"), onError: (e) => toast.error(errorMessage(e)),
  });
  const readOnly = !can("settings.manage");

  return (
    <SettingsCard id="channels" title="Kênh bán" description="Kênh bán chọn ở màn bán hàng (Facebook, Zalo, Website...) — dùng để lọc / nhóm báo cáo.">
      <div className="divide-y text-[13px]">
        {data.map((c) => (
          <div key={c.code} className="flex items-center gap-3 py-2">
            <span className="w-16 text-muted-foreground">{c.code}</span>
            <Input className="h-8 max-w-[260px]" defaultValue={c.name} disabled={readOnly} aria-label={`Tên kênh ${c.code}`}
              onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.name && update.mutate({ ...c, name: e.target.value.trim() })} />
            <label className="ml-auto flex items-center gap-2">Hoạt động
              <SettingSwitch checked={c.active} disabled={readOnly || c.builtin} onCheckedChange={(active) => update.mutate({ ...c, active })} /></label>
            <Button size="icon-sm" variant="ghost" aria-label={`Xóa kênh ${c.name}`} disabled={readOnly || c.builtin || remove.isPending}
              onClick={() => confirm(`Xóa kênh bán ${c.name}?`) && remove.mutate(c.code)}><Trash2 className="size-4" /></Button>
          </div>))}
      </div>
      {!readOnly && (
        <form className="mt-3 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(); }}>
          <Input className="h-8 max-w-[260px]" placeholder="Tên kênh bán mới" aria-label="Tên kênh bán mới" maxLength={100} value={name}
            onChange={(e) => setName(e.target.value)} />
          <Button type="submit" size="sm" variant="outline" disabled={!name.trim() || add.isPending}><Plus className="size-4" /> Thêm kênh</Button>
        </form>)}
    </SettingsCard>
  );
}
