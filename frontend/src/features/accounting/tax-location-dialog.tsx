"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBranches } from "@/features/settings/settings-queries";
import type { TaxLocation } from "./tax-queries";

/** Thêm / sửa địa điểm kinh doanh của 1 mã số thuế: tên, mã, địa chỉ, chi nhánh gắn kèm, ngày chuyển lên kê khai. */
export function TaxLocationDialog({ location, nextCode, onSave, onClose }: {
  location?: TaxLocation; nextCode: string; onSave: (l: TaxLocation) => void; onClose: () => void;
}) {
  const { data: branches = [] } = useBranches();
  const [f, setF] = useState<TaxLocation>(location ?? {
    code: nextCode, name: "", address: "", province: "", ward: "", branchIds: [], startDate: new Date().toISOString().slice(0, 10), active: true,
  });
  const bind = (k: "code" | "name" | "address" | "province" | "ward" | "startDate") => ({
    value: f[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{location ? "Chỉnh sửa" : "Thêm"} địa điểm kinh doanh</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="grid gap-1.5"><Label>Tên địa điểm kinh doanh *</Label><Input placeholder="VD: Trụ sở chính" {...bind("name")} /></div>
          <div className="grid gap-1.5"><Label>Mã địa điểm kinh doanh *</Label><Input {...bind("code")} /></div>
          <div className="col-span-2 grid gap-1.5"><Label>Địa chỉ</Label><Input {...bind("address")} /></div>
          <div className="grid gap-1.5"><Label>Tỉnh/Thành phố</Label><Input {...bind("province")} /></div>
          <div className="grid gap-1.5"><Label>Phường/Xã</Label><Input {...bind("ward")} /></div>
          <div className="col-span-2 grid gap-1.5"><Label>Chi nhánh</Label>
            <div className="flex flex-wrap gap-3 rounded-md border p-2">
              {branches.map((b) => (
                <label key={b.id} className="flex items-center gap-1.5">
                  <Checkbox checked={f.branchIds.includes(b.id)} onCheckedChange={(v) => setF({ ...f,
                    branchIds: v === true ? [...f.branchIds, b.id] : f.branchIds.filter((x) => x !== b.id) })} />{b.name}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5"><Label>Ngày chuyển lên kê khai</Label><Input type="date" {...bind("startDate")} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy bỏ</Button>
          <Button disabled={!f.name.trim() || !f.code.trim()} onClick={() => onSave(f)}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
