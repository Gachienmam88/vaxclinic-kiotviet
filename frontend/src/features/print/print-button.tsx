"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBranches, useShopSettings } from "@/features/settings/settings-queries";
import { usePrintTemplates, storeFields } from "./print-data";
import { printHtml, renderTemplate, type PrintData } from "./print-render";
import { PRINT_DEFS, type PrintType } from "./print-template-defaults";

/** Nút "In" khổ A5 theo mẫu của cửa hàng (hoặc mẫu mặc định). */
export function PrintButton({ type, data, branchId, label = "In" }: {
  type: PrintType; data: PrintData | undefined; branchId?: string | null; label?: string;
}) {
  const { data: templates } = usePrintTemplates();
  const { data: shop } = useShopSettings();
  const { data: branches = [] } = useBranches();
  const print = () => {
    if (!data) return;
    const branchName = branches.find((b) => b.id === branchId)?.name ?? "";
    const template = templates?.[type] ?? PRINT_DEFS[type].template;
    printHtml(renderTemplate(template, { ...storeFields(shop?.store ?? null, branchName), ...data }));
  };
  return (
    <Button variant="outline" disabled={!data} onClick={print}><Printer className="size-4" /> {label}</Button>
  );
}
