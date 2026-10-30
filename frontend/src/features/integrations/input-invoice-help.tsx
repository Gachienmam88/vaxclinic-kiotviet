"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useT } from "@/lib/i18n";
import { inputInvoicesNs } from "@/messages/input-invoices";

const STEPS = ["help.step1", "help.step2", "help.step3", "help.step4"] as const;

/** Nút "?" — hướng dẫn ngắn luồng hóa đơn đầu vào → lập phiếu. */
export function InputInvoiceHelp() {
  const t = useT(inputInvoicesNs);
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" aria-label={t("help.title")} aria-expanded={open} onClick={() => setOpen(!open)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="inline-flex size-[30px] items-center justify-center rounded-md border bg-background hover:bg-muted"><HelpCircle className="size-4" /></button>
      {open && (
        <div role="dialog" className="absolute top-9 right-0 z-50 w-80 rounded-md border bg-popover p-3 text-[13px] shadow-lg">
          <div className="mb-1.5 font-semibold">{t("help.title")}</div>
          <ol className="list-decimal space-y-1 pl-4">{STEPS.map((s) => <li key={s}>{t(s)}</li>)}</ol>
        </div>
      )}
    </div>
  );
}
