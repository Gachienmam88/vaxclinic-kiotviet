"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney, parseNumber } from "@/lib/format";
import { useCommissionTables, useSaveHrSetting } from "./hr-queries";
import { SALARY_TYPES, salaryTypeLabel, type SalaryTemplate, type SalaryType } from "./hr-types";
import { ALLOWANCE_KINDS, DEDUCTION_KINDS, SalaryTemplatePayItems } from "./salary-template-pay-items";

const box = "h-8 w-full rounded-md border border-[#d9dbe0] bg-white px-2 text-[13px] outline-none focus:border-primary";
const EMPTY: SalaryTemplate = { name: "", salaryType: "FIXED", salaryAmount: 0, overtimePercent: 150, commissionTableId: null, allowances: [], deductions: [] };

/** Thiết lập Mẫu lương: bộ lương dựng sẵn (loại lương, mức lương, phụ cấp, giảm trừ, hoa hồng) để áp nhanh cho nhân viên. */
export function SalaryTemplateDialog({ templates, lists, onClose }: { templates: SalaryTemplate[]; lists: { allowances: string[]; deductions: string[] }; onClose: () => void }) {
  const [list, setList] = useState(templates);
  const [editing, setEditing] = useState<{ index: number; t: SalaryTemplate } | null>(null);
  const { data: tables = [] } = useCommissionTables();
  const save = useSaveHrSetting("templates");
  const persist = (next: SalaryTemplate[]) => save.mutate(next, { onSuccess: (r) => { setList(r.templates); setEditing(null); } });
  const t = editing?.t;
  const patch = (p: Partial<SalaryTemplate>) => editing && setEditing({ ...editing, t: { ...editing.t, ...p } });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Thiết lập mẫu lương</DialogTitle></DialogHeader>
        {!t ? (
          <>
            <table className="w-full text-[13px]">
              <thead><tr className="bg-[#f0f2f5] text-left [&_th]:h-8 [&_th]:px-2 [&_th]:font-semibold">
                <th>Tên mẫu lương</th><th>Loại lương</th><th className="text-right">Mức lương</th><th>Phụ cấp / Giảm trừ</th><th />
              </tr></thead>
              <tbody>
                {!list.length && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Chưa có mẫu lương</td></tr>}
                {list.map((x, i) => (
                  <tr key={x.id ?? i} className="border-b border-[#eceef1] [&_td]:px-2 [&_td]:py-2">
                    <td className="font-medium">{x.name}</td><td>{salaryTypeLabel(x.salaryType)}</td>
                    <td className="text-right">{formatMoney(x.salaryAmount ?? 0)}</td>
                    <td>{x.allowances.length} phụ cấp, {x.deductions.length} giảm trừ</td>
                    <td className="text-right whitespace-nowrap">
                      <button type="button" aria-label={`Sửa ${x.name}`} className="mr-2" onClick={() => setEditing({ index: i, t: x })}>
                        <Pencil className="size-3.5 hover:text-primary" /></button>
                      <button type="button" aria-label={`Xóa ${x.name}`} onClick={() => confirm(`Xóa mẫu lương "${x.name}"?`) && persist(list.filter((_, j) => j !== i))}>
                        <Trash2 className="size-3.5 hover:text-destructive" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing({ index: -1, t: EMPTY })}><Plus className="size-4" /> Thêm mẫu lương</Button>
              <Button onClick={onClose}>Xong</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <label className="grid gap-1">Tên mẫu lương *<input className={box} value={t.name} onChange={(e) => patch({ name: e.target.value })} /></label>
              <label className="grid gap-1">Loại lương
                <select className={box} value={t.salaryType ?? "FIXED"} onChange={(e) => patch({ salaryType: e.target.value as SalaryType })}>
                  {SALARY_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></label>
              <label className="grid gap-1">Mức lương ({SALARY_TYPES.find((s) => s[0] === t.salaryType)?.[2]})
                <input className={`${box} text-right`} value={formatMoney(t.salaryAmount ?? 0)}
                  onChange={(e) => patch({ salaryAmount: parseNumber(e.target.value.replace(/[^\d,]/g, "")) })} /></label>
              <label className="grid gap-1">Lương làm thêm giờ (% lương giờ)
                <input type="number" min={0} className={`${box} text-right`} value={t.overtimePercent ?? 150}
                  onChange={(e) => patch({ overtimePercent: Number(e.target.value) })} /></label>
              <label className="col-span-2 grid gap-1">Bảng hoa hồng
                <select className={box} value={t.commissionTableId ?? ""} onChange={(e) => patch({ commissionTableId: e.target.value || null })}>
                  <option value="">Không áp dụng</option>{tables.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select></label>
            </div>
            <SalaryTemplatePayItems title="Phụ cấp" items={t.allowances} kinds={ALLOWANCE_KINDS} suggestions={lists.allowances}
              onChange={(allowances) => patch({ allowances })} />
            <SalaryTemplatePayItems title="Giảm trừ" items={t.deductions} kinds={DEDUCTION_KINDS} suggestions={lists.deductions}
              onChange={(deductions) => patch({ deductions })} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Quay lại</Button>
              <Button disabled={!t.name.trim() || [...t.allowances, ...t.deductions].some((p) => !p.name.trim()) || save.isPending}
                onClick={() => editing && persist(editing.index < 0 ? [...list, t] : list.map((x, j) => (j === editing.index ? t : x)))}>Lưu mẫu lương</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
