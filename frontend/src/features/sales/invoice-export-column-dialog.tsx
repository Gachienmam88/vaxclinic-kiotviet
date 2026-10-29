"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { commonNs } from "@/messages/common";
import { salesNs } from "@/messages/sales";
import { kvDialog, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn } from "./customer-ui-primitives";
import { ALL_DETAIL_KEYS, DETAIL_GROUPS } from "./invoice-export-fields";

const KEY = "kv.invoices.detailExportColumns";

function readSaved(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as string[] | null;
    return v?.length ? v.filter((k) => ALL_DETAIL_KEYS.includes(k)) : ALL_DETAIL_KEYS;
  } catch {
    return ALL_DETAIL_KEYS;
  }
}

/**
 * "Tùy chọn cột hiển thị — Chọn ít nhất 1 cột để xuất file" (KiotViet): nhóm Hóa đơn / Thanh toán / Khách hàng / Hàng hóa /
 * Giao hàng / Thông tin khác, lưới 2 cột, đếm đã chọn / tổng; nhớ lựa chọn trên máy này. Tên cột = tiêu đề cột file (tiếng Việt).
 */
export function InvoiceExportColumnDialog({ onClose, onExport }: { onClose: () => void; onExport: (keys: string[]) => void }) {
  const t = useT(salesNs);
  const tc = useT(commonNs);
  const [sel, setSel] = useState<string[]>(readSaved);
  const toggle = (k: string, on: boolean) => setSel((s) => (on ? [...s, k] : s.filter((x) => x !== k)));
  const submit = () => {
    try { localStorage.setItem(KEY, JSON.stringify(sel)); } catch { /* trình duyệt chặn lưu: vẫn xuất được */ }
    onExport(sel);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(kvDialog, "sm:max-w-[500px]")}>
        <DialogHeader className={kvDialogHeader}>
          <DialogTitle className={kvDialogTitle}>{t("invoices.exportColumns.title")}</DialogTitle>
          <DialogDescription className="text-[13px]">{t("invoices.exportColumns.hint")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto px-5 pb-2 text-[13px]">
          {DETAIL_GROUPS.map((g, gi) => {
            const count = g.fields.filter((f) => sel.includes(f.key)).length;
            return (
              <section key={g.key} className={cn("py-3", gi > 0 && "border-t")}>
                <h3 className="mb-2 flex items-center gap-2 font-semibold">{t(`invoices.exportColumns.groups.${g.key as "invoice"}`)}
                  <span className="rounded bg-[#eff0f3] px-1.5 text-[11px] font-semibold">{count}/{g.fields.length}</span></h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  {g.fields.map((f) => (
                    <label key={f.key} className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" className="size-4 shrink-0 rounded accent-primary" checked={sel.includes(f.key)}
                        onChange={(e) => toggle(f.key, e.target.checked)} /> {f.label}
                    </label>))}
                </div>
              </section>);
          })}
        </div>
        <DialogFooter className={cn(kvDialogFooter, "items-center sm:justify-between")}>
          <button type="button" className="text-[13px] text-[#2171bc] hover:text-[#1a9dcc]" onClick={() => setSel(sel.length ? [] : ALL_DETAIL_KEYS)}>
            {sel.length ? t("invoices.exportColumns.clearAll") : t("invoices.exportColumns.selectAll")}</button>
          <div className="flex gap-2">
            <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{tc("actions.skip")}</Button>
            <Button className={kvFooterBtn} disabled={!sel.length} onClick={submit}>{tc("actions.export")}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
