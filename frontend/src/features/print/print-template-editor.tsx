"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Printer, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { printNs } from "@/messages/print";
import { pageDocument, printHtml, renderTemplate, sanitizeHtml, type PrintData } from "./print-render";
import { PRINT_DEFS, type PrintType } from "./print-template-defaults";

/** Xem trước A5 trong iframe sandbox (không chạy script). */
export function A5Preview({ html, scale = 0.8 }: { html: string; scale?: number }) {
  const t = useT(printNs);
  return (
    <div className="mx-auto rounded-md bg-white shadow-sm" style={{ width: 559 * scale, height: 794 * scale }}>
      <iframe title={t("editor.previewTitle")} sandbox="" className="origin-top-left border-0"
        style={{ width: 559, height: 794, transform: `scale(${scale})` }} srcDoc={pageDocument(sanitizeHtml(html))} />
    </div>
  );
}

/**
 * Sửa mẫu in toàn màn hình: trái = mã HTML + chèn trường, phải = xem trước A5 với dữ liệu mẫu.
 * Cú pháp: {Ten_Truong}; khối lặp dòng hàng {#Dong_Hang}...{/Dong_Hang}.
 */
export function PrintTemplateEditor({ type, current, data, onClose }: {
  type: PrintType; current: string; data: PrintData; onClose: () => void;
}) {
  const qc = useQueryClient();
  const t = useT(printNs);
  const tc = useT(commonNs);
  const def = PRINT_DEFS[type];
  const [html, setHtml] = useState(current);
  const area = useRef<HTMLTextAreaElement>(null);
  const done = (msg: string) => (d: Partial<Record<PrintType, string>>) => { qc.setQueryData(["print-templates"], d); toast.success(msg); onClose(); };
  const save = useMutation({
    mutationFn: () => api<Partial<Record<PrintType, string>>>(`/print-templates/${type}`, { method: "PUT", body: { html } }),
    onSuccess: done(t("editor.saved")), onError: (e) => toast.error(errorMessage(e)),
  });
  const reset = useMutation({
    mutationFn: () => api<Partial<Record<PrintType, string>>>(`/print-templates/${type}`, { method: "DELETE" }),
    onSuccess: done(t("editor.resetDone")), onError: (e) => toast.error(errorMessage(e)),
  });

  function insert(text: string) {
    const el = area.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    setHtml(html.slice(0, a) + text + html.slice(b));
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = a + text.length; });
  }
  const rendered = renderTemplate(html, data);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-muted">
      <div className="flex items-center gap-3 border-b bg-background px-4 py-2">
        <h2 className="text-[15px] font-semibold">{t("editor.title", { name: t(`types.${type}`) })}</h2>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" disabled={reset.isPending}
            onClick={() => confirm(t("editor.confirmReset")) && reset.mutate()}><RotateCcw className="size-4" /> {t("editor.reset")}</Button>
          <Button variant="outline" onClick={() => printHtml(rendered)}><Printer className="size-4" /> {t("editor.testPrint")}</Button>
          <Button disabled={save.isPending || !html.trim()} onClick={() => save.mutate()}><Save className="size-4" /> {t("editor.saveTemplate")}</Button>
          <Button variant="ghost" size="icon" aria-label={tc("actions.close")} onClick={onClose}><X className="size-4" /></Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-lg bg-background p-3">
          <div className="max-h-40 space-y-1 overflow-y-auto text-xs">
            <p className="text-muted-foreground">{t("editor.insertHint")}</p>
            <div className="flex flex-wrap gap-1">
              {def.fields.map(([k, label]) => (
                <button key={k} type="button" className="rounded border bg-muted/50 px-1.5 py-0.5 hover:bg-primary/10" onClick={() => insert(`{${k}}`)}>{t(`fields.${label}`)}</button>
              ))}
            </div>
            {def.lineFields.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <button type="button" className="rounded border border-primary/40 px-1.5 py-0.5 text-primary" onClick={() => insert("{#Dong_Hang}{/Dong_Hang}")}>
                  {t("editor.lineBlock")}</button>
                {def.lineFields.map(([k, label]) => (
                  <button key={k} type="button" className="rounded border bg-primary/5 px-1.5 py-0.5 hover:bg-primary/10" onClick={() => insert(`{${k}}`)}>{t(`fields.${label}`)}</button>
                ))}
              </div>
            )}
          </div>
          <textarea ref={area} spellCheck={false} value={html} onChange={(e) => setHtml(e.target.value)}
            className="min-h-0 flex-1 resize-none rounded-md border p-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
        </div>
        <div className="w-[480px] shrink-0 overflow-y-auto rounded-lg bg-background p-3">
          <p className="mb-2 text-[13px] font-medium">{t("editor.previewHeading")}</p>
          <p className="mb-2 text-[11px] text-muted-foreground">{tc("legal.vietnameseOnly")}</p>
          <A5Preview html={rendered} />
        </div>
      </div>
    </div>
  );
}
