"use client";

import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useT } from "@/lib/i18n";
import { inputInvoicesNs } from "@/messages/input-invoices";

/** Loại chứng từ lập từ hóa đơn đầu vào (KiotViet "Lập phiếu ▾"). */
export type CreateKind = "RECEIPT" | "SERVICE" | "CASH" | "TRANSFER" | "EWALLET";

const OPTIONS = [
  ["RECEIPT", "create.receipt"], ["SERVICE", "create.service"], ["CASH", "create.cash"], ["TRANSFER", "create.transfer"],
  ["EWALLET", "create.ewallet"],
] as const;

export function InputInvoiceCreateMenu({ onPick }: { onPick: (kind: CreateKind) => void }) {
  const t = useT(inputInvoicesNs);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2 text-xs hover:bg-muted"
        aria-label={t("table.create")}>
        {t("table.create")} <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {OPTIONS.map(([kind, label]) => (
          <DropdownMenuItem key={kind} className="py-2 text-[13px]" onClick={() => onPick(kind)}>{t(label)}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
