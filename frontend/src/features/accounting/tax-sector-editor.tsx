"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/features/products/product-form-sections";
import { flattenCategoryTree, useCategories, useTaxRates } from "@/features/products/product-queries";
import type { Sector, TaxSettings } from "./tax-queries";

/** Mã ngành tự sinh từ tên (không dấu, viết hoa), thêm số nếu trùng. */
function codeFor(name: string, taken: string[]) {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "D").toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || "NGANH";
  let code = base;
  for (let i = 2; taken.includes(code); i++) code = `${base}_${i}`;
  return code;
}

/**
 * "Ngành nghề & tỷ lệ thuế": danh sách ngành (tên, % GTGT, % TNCN — thêm / sửa / xóa), ngành mặc định, thuế suất mặc định,
 * và gắn ngành cho từng nhóm hàng (nhóm con để trống = theo nhóm cha).
 */
export function TaxSectorDialog({ tax, onSave, onClose }: { tax: TaxSettings; onSave: (t: TaxSettings) => void; onClose: () => void }) {
  const { data: rates = [] } = useTaxRates();
  const { data: categories = [] } = useCategories();
  const [f, setF] = useState(tax);
  const setSector = (i: number, patch: Partial<Sector>) => setF({ ...f, sectors: f.sectors.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const addSector = () => {
    const name = "Ngành mới";
    setF({ ...f, sectors: [...f.sectors, { code: codeFor(name, f.sectors.map((s) => s.code)), name, vatRate: 0, pitRate: 0 }] });
  };
  const removeSector = (code: string) => {
    if (f.defaultSector === code) { alert("Không xóa được ngành nghề mặc định — hãy chọn ngành mặc định khác trước."); return; }
    const categorySectors = Object.fromEntries(Object.entries(f.categorySectors).filter(([, c]) => c !== code));
    setF({ ...f, sectors: f.sectors.filter((s) => s.code !== code), categorySectors });
  };
  const setCategory = (id: string, code: string) => {
    const next = { ...f.categorySectors };
    if (code) next[id] = code; else delete next[id];
    setF({ ...f, categorySectors: next });
  };
  const valid = f.sectors.length > 0 && f.sectors.every((s) => s.name.trim() && s.vatRate >= 0 && s.pitRate >= 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Ngành nghề kinh doanh & tỷ lệ thuế trên doanh thu</DialogTitle></DialogHeader>
        <div className="space-y-4 text-[13px]">
          <table className="w-full">
            <thead className="bg-[#f0f2f5] text-left text-xs [&_th]:h-[34px] [&_th]:font-semibold"><tr><th className="px-2 py-2">Ngành nghề</th><th className="w-28 px-2">GTGT (%)</th>
              <th className="w-28 px-2">TNCN (%)</th><th className="w-24 px-2 text-center">Mặc định</th><th className="w-10" /></tr></thead>
            <tbody>
              {f.sectors.map((s, i) => (
                <tr key={s.code} className="border-b">
                  <td className="px-2 py-1.5"><Input value={s.name} onChange={(e) => setSector(i, { name: e.target.value })} /></td>
                  <td className="px-2"><Input type="number" step="0.1" min={0} value={s.vatRate} onChange={(e) => setSector(i, { vatRate: Number(e.target.value) })} /></td>
                  <td className="px-2"><Input type="number" step="0.1" min={0} value={s.pitRate} onChange={(e) => setSector(i, { pitRate: Number(e.target.value) })} /></td>
                  <td className="px-2 text-center"><input type="radio" className="accent-primary" checked={f.defaultSector === s.code}
                    onChange={() => setF({ ...f, defaultSector: s.code })} /></td>
                  <td><Button size="icon-sm" variant="ghost" className="text-destructive" title="Xóa ngành" onClick={() => removeSector(s.code)}><Trash2 className="size-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button variant="outline" size="sm" onClick={addSector}><Plus className="size-4" /> Thêm ngành nghề</Button>

          <div className="space-y-2 border-t pt-3">
            <p className="font-medium">Gắn ngành nghề cho nhóm hàng</p>
            <p className="text-muted-foreground">Doanh thu của hàng hóa được tính thuế theo ngành của nhóm hàng. Nhóm con để trống thì theo nhóm cha; không gắn thì theo ngành mặc định.</p>
            <div className="max-h-64 divide-y overflow-y-auto rounded-md border">
              {!categories.length && <p className="p-3 text-muted-foreground">Chưa có nhóm hàng (tạo ở Thiết lập → Hàng hóa).</p>}
              {flattenCategoryTree(categories).map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-1.5" style={{ paddingLeft: 12 + c.depth * 20 }}>
                  <span className="flex-1">{c.name}</span>
                  <div className="w-72"><NativeSelect value={f.categorySectors[c.id] ?? ""} onChange={(e) => setCategory(c.id, e.target.value)}>
                    <option value="">{c.depth ? "-- Theo nhóm cha --" : "-- Theo ngành mặc định --"}</option>
                    {f.sectors.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</NativeSelect></div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5 border-t pt-3"><Label>Thuế suất mặc định của hàng hóa chưa chọn thuế</Label>
            <NativeSelect value={f.defaultTaxCode ?? ""} onChange={(e) => setF({ ...f, defaultTaxCode: e.target.value || null })}>
              {rates.map((r) => <option key={r.id} value={r.code}>{r.name}</option>)}</NativeSelect></div>
          <p className="text-xs text-muted-foreground">Hàng có thuế suất KCT / KKKNT không tính GTGT. Vắc xin, dịch vụ y tế thường thuộc diện không chịu thuế GTGT.
            Tỷ lệ mặc định lấy theo quy định thuế hộ kinh doanh 2026 — hãy để kế toán xác nhận.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy bỏ</Button>
          <Button disabled={!valid} onClick={() => onSave(f)}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
