"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { useBranches, useShopSettings } from "@/features/settings/settings-queries";
import { usePrintTemplates, storeFields } from "./print-data";
import { printHtml, renderTemplate, type PrintData } from "./print-render";
import { PRINT_DEFS, type PrintType } from "./print-template-defaults";

/** Hàm in theo mẫu của cửa hàng (hoặc mẫu mặc định) — dùng cho nút In và in ngay sau khi bán. */
export function usePrinter() {
  const { data: templates } = usePrintTemplates();
  const { data: shop } = useShopSettings();
  const { data: branches = [] } = useBranches();
  return (type: PrintType, data: PrintData, branchId?: string | null) => {
    const branchName = branches.find((b) => b.id === branchId)?.name ?? "";
    const template = templates?.[type] ?? PRINT_DEFS[type].template;
    printHtml(renderTemplate(template, { ...storeFields(shop?.store ?? null, branchName), ...data }));
  };
}

/** Nút "In" khổ A5 (mặc định nhãn common.actions.print). */
export function PrintButton({ type, data, branchId, label }: {
  type: PrintType; data: PrintData | undefined; branchId?: string | null; label?: string;
}) {
  const print = usePrinter();
  const tc = useT(commonNs);
  return (
    <Button variant="outline" disabled={!data} onClick={() => data && print(type, data, branchId)}><Printer className="size-4" /> {label ?? tc("actions.print")}</Button>
  );
}
