"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n";
import { saleNs } from "@/messages/sale";
import type { SaleBranch } from "./use-sale-branch";

/** Chọn chi nhánh bán (đầu cột thanh toán): tên chi nhánh + ▾ → danh sách chi nhánh được phân công, đang chọn có ✓. */
export function SaleBranchPicker({ branch }: { branch: SaleBranch }) {
  const t = useT(saleNs);
  const [open, setOpen] = useState(false);
  const many = branch.options.length > 1;
  return (
    <div className="relative min-w-0 shrink-0">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={t("branch.label")} title={branch.name}
        disabled={!many} onClick={() => setOpen(!open)} className="flex max-w-[140px] items-center gap-1 overflow-hidden text-[13px] font-medium disabled:cursor-default">
        <span className="min-w-0 truncate">{branch.name || t("branch.label")}</span>
        {many && <ChevronDown className="size-4 shrink-0 text-[#4b5563]" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <div role="listbox" aria-label={t("branch.label")}
            className="absolute top-full left-0 z-50 mt-1.5 max-h-72 w-60 overflow-y-auto rounded-md bg-popover p-1.5 text-[13px] shadow-lg ring-1 ring-foreground/10">
            {branch.options.map((b) => (
              <button key={b.id} type="button" role="option" aria-selected={b.id === branch.id}
                className={`flex w-full items-center justify-between rounded px-2.5 py-2 text-left ${b.id === branch.id ? "bg-primary-tint" : "hover:bg-muted"}`}
                onClick={() => { branch.select(b.id); setOpen(false); }}>
                <span className="truncate">{b.name}</span>{b.id === branch.id && <Check className="size-4 shrink-0 text-primary" />}
              </button>))}
          </div>
        </>
      )}
    </div>
  );
}
