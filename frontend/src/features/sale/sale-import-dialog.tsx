"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { importInvoiceWorkbook, downloadImportTemplate, type ImportResult, type ImportedSheet } from "./sale-import-workbook";
import { MAX_ROWS, MAX_SHEETS } from "./sale-import-parse";
import { useT } from "@/lib/i18n";
import { renderRichText } from "@/lib/i18n/render-rich-text";
import { commonNs } from "@/messages/common";
import { saleNs } from "@/messages/sale";
import type { CatalogProduct } from "./sale-types";

type Props = {
  catalog: CatalogProduct[]; branchId: string; onImported: (sheets: ImportedSheet[]) => void; onClose: () => void;
};

/**
 * "Nhập danh sách hóa đơn từ file excel": Tải về file mẫu, Chọn file → mỗi trang tính hợp lệ thành 1 tab hóa đơn;
 * lỗi theo từng trang tính / dòng hiện ngay trong hộp thoại (trang tính lỗi không được nhập).
 */
export function SaleImportDialog({ catalog, branchId, onImported, onClose }: Props) {
  const t = useT(saleNs);
  const tc = useT(commonNs);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const r = await importInvoiceWorkbook(file, catalog, branchId, t);
      setResult(r);
      if (r.imported.length) {
        onImported(r.imported);
        toast.success(t("import.imported", { count: r.imported.length, file: file.name }));
        if (!r.errors.length) onClose();
      }
    } catch (e) {
      toast.error(t("import.readFailed", { message: (e as Error).message }));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-3 p-6 text-[13px] sm:max-w-[366px]">
        <DialogHeader><DialogTitle className="text-[15px] font-bold">{t("import.title")}</DialogTitle></DialogHeader>
        <p>{renderRichText(t("import.processData"), { template: <button type="button" className="text-primary hover:underline"
          onClick={() => downloadImportTemplate().catch((e) => toast.error((e as Error).message))}>{t("import.downloadTemplate")}</button> })}</p>
        <div className="text-xs leading-5 text-[#4b5563]">
          <p className="font-bold">{t("import.noteTitle")}</p>
          <p>{t("import.note", { sheets: MAX_SHEETS, rows: MAX_ROWS })}</p>
          <p>{t("import.headersVietnamese")}</p>
        </div>
        <input ref={input} type="file" hidden accept=".xlsx,.xls" onChange={(e) => pick(e.target.files?.[0])} />
        <button type="button" disabled={busy} onClick={() => input.current?.click()}
          className="mx-auto h-[26px] rounded-full border border-[#9ca3af] px-4 hover:border-primary hover:text-primary disabled:opacity-50">
          {busy ? tc("status.processing") : t("import.chooseFile")}</button>
        {result && result.errors.length > 0 && (
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-md bg-destructive/5 p-2.5 text-xs text-destructive">
            {result.imported.length > 0 && <p className="font-semibold text-[#16a34a]">{t("import.importedSheets", { count: result.imported.length })}</p>}
            {result.errors.map((e) => (
              <div key={e.sheet}><p className="font-semibold">{t("import.sheetRejected", { sheet: e.sheet })}</p>
                <ul className="list-disc pl-4">{e.messages.map((m, i) => <li key={i}>{m}</li>)}</ul></div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
