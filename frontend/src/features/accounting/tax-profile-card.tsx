"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/features/products/product-form-sections";
import { useBranches } from "@/features/settings/settings-queries";
import { formatDate } from "@/lib/format";
import { GROUPS } from "./tax-calc";
import { TaxLocationDialog } from "./tax-location-dialog";
import type { TaxLocation, TaxProfile } from "./tax-queries";

/** Hồ sơ kê khai của 1 MST: bật/tắt, nhóm doanh thu, cách tính TNCN, danh sách địa điểm kinh doanh. */
export function TaxProfileCard({ profile, readOnly, onChange, onDelete }: {
  profile: TaxProfile; readOnly: boolean; onChange: (p: TaxProfile) => void; onDelete: () => void;
}) {
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
    if (!active && !confirm("Ngừng hoạt động địa điểm kinh doanh?\nDữ liệu các chi nhánh thuộc địa điểm này sẽ không được tiếp tục đưa vào sổ kế toán và tờ khai từ thời điểm hiện tại. Dữ liệu cũ không thay đổi.")) return;
    set({ locations: profile.locations.map((l, j) => (j === i ? { ...l, active } : l)) });
  };

  return (
    <div className="rounded-lg border border-primary/40">
      <button type="button" className="flex w-full items-center gap-2 px-4 py-3" onClick={() => setOpen(!open)}>
        <span className="text-lg font-semibold text-primary">{profile.taxCode}</span>
        <Badge variant={profile.active ? "default" : "secondary"}>{profile.active ? "Đang kê khai" : "Ngừng kê khai"}</Badge>
        {open ? <ChevronUp className="ml-auto size-4" /> : <ChevronDown className="ml-auto size-4" />}
      </button>
      {open && (
        <div className="space-y-4 border-t px-4 py-3 text-sm">
          <div className="flex items-center gap-4">
            <div className="flex-1"><p className="font-medium">Quản lý hồ sơ kê khai</p>
              <p className="text-muted-foreground">Dựa trên nhóm doanh thu và phương pháp tính thuế, hệ thống tự tổng hợp dữ liệu cho sổ kế toán và tờ khai của từng địa điểm kinh doanh.</p></div>
            <Switch checked={profile.active} disabled={readOnly} onCheckedChange={(v) => set({ active: v })} />
          </div>
          <div className="grid grid-cols-[12rem_1fr] items-center gap-3 border-t pt-3">
            <span>Nhóm doanh thu</span>
            <div className="w-64"><NativeSelect value={profile.revenueGroup} disabled={readOnly}
              onChange={(e) => set({ revenueGroup: Number(e.target.value) })}>
              {Object.entries(GROUPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></div>
            <span>Phương pháp tính thuế TNCN</span>
            <div className="flex gap-4">
              {([["REVENUE", "Tính theo doanh thu"], ["PROFIT", "Tính theo thu nhập (doanh thu - chi phí)"]] as const).map(([v, label]) => (
                <label key={v} className="flex items-center gap-1.5">
                  <input type="radio" className="accent-primary" disabled={readOnly || profile.revenueGroup === 1}
                    checked={profile.pitMethod === v} onChange={() => set({ pitMethod: v })} />{label}</label>
              ))}
            </div>
          </div>
          <div className="border-t pt-3">
            <div className="mb-2 flex items-center"><b>Danh sách địa điểm kinh doanh</b>
              {!readOnly && <Button variant="outline" size="sm" className="ml-auto" onClick={() => setDialog({})}><Plus className="size-4" /> Thêm địa điểm kinh doanh</Button>}</div>
            <table className="w-full">
              <thead className="bg-muted/60 text-left"><tr><th className="px-2 py-2">Mã địa điểm</th><th className="px-2">Tên địa điểm</th><th className="px-2">Địa chỉ</th>
                <th className="px-2">Chi nhánh</th><th className="px-2">Ngày chuyển lên kê khai</th><th className="px-2">Trạng thái</th><th className="w-12 px-2" /></tr></thead>
              <tbody>
                {!profile.locations.length && <tr><td colSpan={7} className="py-4 text-center text-muted-foreground">Chưa có địa điểm — sổ sách sẽ tính tất cả chi nhánh chưa gắn địa điểm nào</td></tr>}
                {profile.locations.map((l, i) => (
                  <tr key={l.code} className="border-b">
                    <td className="px-2 py-2">{l.code}</td>
                    <td className="px-2"><span className="flex items-center gap-1 text-green-700"><MapPin className="size-3.5" />{l.name}</span></td>
                    <td className="px-2">{[l.address, l.ward, l.province].filter(Boolean).join(", ")}</td>
                    <td className="px-2">{l.branchIds.map((id) => branches.find((b) => b.id === id)?.name).filter(Boolean).join(", ")}</td>
                    <td className="px-2">{formatDate(l.startDate)}</td>
                    <td className="px-2"><Switch checked={l.active} disabled={readOnly} onCheckedChange={(v) => toggleLocation(i, v)} /></td>
                    <td className="px-2">{!readOnly && <Button size="icon-sm" variant="outline" onClick={() => setDialog({ index: i })}><Pencil className="size-4" /></Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readOnly && (
            <div className="flex items-center border-t pt-3">
              <div className="flex-1"><p className="font-medium">Xóa mã số thuế</p>
                <p className="text-muted-foreground">Thiết lập thuế của mã số thuế {profile.taxCode} sẽ bị xóa. Dữ liệu bán hàng không bị ảnh hưởng.</p></div>
              <Button variant="outline" onClick={() => confirm(`Xóa mã số thuế ${profile.taxCode}?`) && onDelete()}><Trash2 className="size-4" /> Xóa mã số thuế</Button>
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
