"use client";

import { useRef, useState } from "react";
import { FileDown, Upload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { api, errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { commonNs } from "@/messages/common";
import { salesNs } from "@/messages/sales";
import { kvDialog, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn } from "./customer-ui-primitives";
import { downloadInvoiceImportTemplate, readInvoiceImportFile } from "./invoice-import-template";
import { SALES_KEYS } from "./sales-queries";

type Result = { invoices: number; created: { id: string; code: string }[]; skipped: number;
  errors: { line: number; message: string }[]; failed: { line: number; message: string } | null };

/**
 * "Import file" hóa đơn: tải file mẫu, chọn file .xlsx / .csv → backend kiểm tra toàn bộ file; có lỗi thì không lưu hóa đơn nào
 * và hiện lỗi theo dòng. Mỗi lần mở hộp thoại 1 mã import: bấm lại sau lỗi mạng không tạo trùng.
 */
export function InvoiceImportDialog({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  const t = useT(salesNs);
  const tc = useT(commonNs);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importId, setImportId] = useState(() => crypto.randomUUID());
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  async function upload() {
    if (!file) return;
    setPending(true);
    setFileError(null);
    try {
      const rows = await readInvoiceImportFile(file, { header: (col, name) => t("invoices.import.badHeader", { col, name }), empty: t("invoices.import.emptyFile") })
        .catch((e: Error) => { setFileError(e.message); return null; });
      if (!rows) return;
      const r = await api<Result>("/invoices/import", { method: "POST", body: { id: importId, branchId, rows } });
      setResult(r);
      if (r.created.length) {
        SALES_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: k }));
        toast.success(t("invoices.import.toastDone", { count: r.created.length }));
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPending(false);
    }
  }

  const problems = result ? [...result.errors, ...(result.failed ? [result.failed] : [])] : [];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(kvDialog, "sm:max-w-[600px]")}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>{t("invoices.import.title")}</DialogTitle></DialogHeader>
        <div className="space-y-3 px-5 pb-4 text-[13px]">
          <p>{t("invoices.import.template")}{" "}
            <button type="button" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline" onClick={() => downloadInvoiceImportTemplate()}>
              <FileDown className="size-4" /> {t("invoices.import.templateLink")}</button></p>
          <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
            <li>{t("invoices.import.ruleGroup")}</li><li>{t("invoices.import.ruleAllOrNothing")}</li><li>{t("invoices.import.ruleLot")}</li>
          </ul>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => {
            setFile(e.target.files?.[0] ?? null); setResult(null); setFileError(null); setImportId(crypto.randomUUID()); e.target.value = "";
          }} />
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-8 rounded-md" onClick={() => fileRef.current?.click()}><Upload className="size-4" /> {t("invoices.import.chooseFile")}</Button>
            {file && <span className="truncate">{file.name}</span>}
          </div>
          {fileError && <p className="text-destructive">{fileError}</p>}
          {result && (
            <div className="rounded-md border border-[#e5e7eb] bg-[#f7f8fa] p-3">
              {result.created.length > 0 && (
                <p>{t("invoices.import.created", { count: result.created.length })}{" "}
                  {result.created.map((c, n) => <span key={c.id}>{n > 0 && ", "}<DocCodeLink code={c.code} kind="/invoices" /></span>)}</p>)}
              {result.skipped > 0 && <p>{t("invoices.import.skipped", { count: result.skipped })}</p>}
              {result.errors.length > 0 && <p className="font-semibold text-destructive">{t("invoices.import.nothingSaved", { count: result.errors.length })}</p>}
              {problems.length > 0 && (
                <ul className="mt-2 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-destructive">
                  {problems.map((e, n) => <li key={n}>{t("invoices.import.lineError", { line: e.line, message: e.message })}</li>)}
                </ul>)}
            </div>)}
        </div>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{result ? tc("actions.close") : tc("actions.skip")}</Button>
          <Button className={kvFooterBtn} disabled={!file || pending} onClick={upload}>{t("invoices.import.submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
