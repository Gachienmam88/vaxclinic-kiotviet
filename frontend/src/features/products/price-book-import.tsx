"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api-client";
import { parsePriceCsv } from "./price-book-csv";
import { useImportPrices } from "./price-book-queries";
import type { ImportResult, PriceBook } from "./price-book-types";
import { renderRichText } from "@/lib/i18n/render-rich-text";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { productsNs } from "@/messages/products";

/**
 * "Nhập file" giá vào 1 bảng giá: start(book) mở hộp chọn file CSV (Mã hàng, Giá), gửi lên server,
 * rồi hiện kết quả kèm danh sách dòng lỗi. `element` phải được render trong trang.
 */
export function usePriceImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<PriceBook | null>(null);
  const [result, setResult] = useState<{ book: PriceBook; data: ImportResult } | null>(null);
  const importPrices = useImportPrices();
  const t = useT(productsNs);
  const tc = useT(commonNs);

  function start(book: PriceBook) {
    target.current = book;
    fileRef.current?.click();
  }

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    const book = target.current;
    if (fileRef.current) fileRef.current.value = "";
    if (!file || !book) return;
    const rows = parsePriceCsv(await file.text(), book.name);
    if (!rows.length) return toast.error(t("import.noRows"));
    importPrices.mutate({ bookId: book.id, rows }, {
      onSuccess: (data) => setResult({ book, data }),
      onError: (e) => toast.error(errorMessage(e)),
    });
  }

  const element = (
    <>
      <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => onFile(e.target.files)} />
      {result && (
        <Dialog open onOpenChange={(o) => !o && setResult(null)}>
          <DialogContent className="rounded-lg sm:max-w-[560px]">
            <DialogHeader><DialogTitle className="text-base font-bold">{t("import.resultTitle", { name: result.book.name })}</DialogTitle></DialogHeader>
            <p className="text-[13px]">
              {renderRichText(t(result.data.errors.length ? "import.resultWithErrors" : "import.result"), {
                updated: <b>{result.data.updated}</b>,
                errors: <span className="text-destructive">{t("import.errorRows", { count: result.data.errors.length })}</span>,
              })}
            </p>
            {result.data.errors.length > 0 && (
              <div className="max-h-72 overflow-y-auto rounded border text-[13px]">
                <table className="w-full">
                  <thead className="bg-muted text-left"><tr><th className="px-2 py-1">{t("import.line")}</th><th className="px-2 py-1">{t("fields.code")}</th><th className="px-2 py-1">{t("import.error")}</th></tr></thead>
                  <tbody>
                    {result.data.errors.map((e) => (
                      <tr key={e.line} className="border-t"><td className="px-2 py-1">{e.line}</td><td className="px-2 py-1">{e.code}</td>
                        <td className="px-2 py-1 text-destructive">{e.message}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <DialogFooter><Button onClick={() => setResult(null)}>{tc("actions.close")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
  return { start, element, isPending: importPrices.isPending };
}
