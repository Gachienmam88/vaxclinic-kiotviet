"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VnAddressFields } from "@/components/ui/vn-address-fields";
import { useBranches } from "@/features/settings/settings-queries";
import type { TaxLocation } from "./tax-queries";
import { DatePicker } from "@/components/ui/date-picker";

/** Thêm / sửa địa điểm kinh doanh của 1 mã số thuế: tên, mã, địa chỉ, chi nhánh gắn kèm, ngày chuyển lên kê khai. */
export function TaxLocationDialog({ location, nextCode, onSave, onClose }: {
  location?: TaxLocation; nextCode: string; onSave: (l: TaxLocation) => void; onClose: () => void;
}) {
  const { data: branches = [] } = useBranches();
  const [f, setF] = useState<TaxLocation>(location ?? {
    code: nextCode, name: "", address: "", province: "", ward: "", branchIds: [], startDate: new Date().toISOString().slice(0, 10), active: true,
  });
  const bind = (k: "code" | "name" | "startDate") => ({
    value: f[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{location ? "Chỉnh sửa" : "Thêm"} địa điểm kinh doanh</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="grid gap-1.5"><Label>Tên địa điểm kinh doanh *</Label><Input placeholder="VD: Trụ sở chính" {...bind("name")} /></div>
          <div className="grid gap-1.5"><Label>Mã địa điểm kinh doanh *</Label><Input {...bind("code")} /></div>
          <VnAddressFields idPrefix="tax-loc" fieldClassName="grid gap-1.5" addressFieldClassName="col-span-2"
            labelClassName="text-sm font-medium leading-none" labels={{ province: "Tỉnh/Thành phố" }}
            value={{ address: f.address ?? "", provinceCode: f.provinceCode ?? "", provinceName: f.province ?? "",
              wardCode: f.wardCode ?? "", wardName: f.ward ?? "" }}
            onChange={(v) => setF({ ...f, address: v.address, province: v.provinceName, ward: v.wardName,
              provinceCode: v.provinceCode || null, wardCode: v.wardCode || null })} />
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
          <div className="grid gap-1.5"><Label>Ngày chuyển lên kê khai</Label><DatePicker value={f.startDate} onChange={(v) => setF({ ...f, startDate: v })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy bỏ</Button>
          <Button disabled={!f.name.trim() || !f.code.trim()} onClick={() => onSave(f)}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
