"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";
import { StatusBadge } from "@/features/sales/invoice-list-kit";
import { useEInvoiceRecords, type EInvoiceRecord } from "./integration-queries";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

/** Trạng thái HĐĐT + nút "Phát hành HĐĐT" trong chi tiết hóa đơn bán. Phát hành lại sau lỗi dùng lại RefID cũ (MISA chống trùng). */
export function EInvoiceStatus({ invoiceId, active }: { invoiceId: string; active: boolean }) {
  const qc = useQueryClient();
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  const { data = [] } = useEInvoiceRecords([invoiceId]);
  const rec = data[0];
  const publish = useMutation({
    mutationFn: () => api<EInvoiceRecord>(`/einvoices/${invoiceId}/publish`, { method: "POST" }),
    onSuccess: (r) => {
      if (r.status === "PUBLISHED") toast.success(t("inputInvoices.einvoice.toastPublished", { no: r.inv_no ?? "" }));
      else toast.error(t("inputInvoices.einvoice.toastFailed", { error: r.error ?? "" }));
      qc.invalidateQueries({ queryKey: ["einvoices"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (rec?.status === "PUBLISHED") {
    return (
      <span className="flex items-center gap-2 text-sm">
        <StatusBadge tone="green">{t("inputInvoices.einvoice.published")}</StatusBadge>
        {t("inputInvoices.einvoice.publishedInfo", { series: rec.inv_series ?? "", no: rec.inv_no ?? "" })}
        {rec.inv_code && t("inputInvoices.einvoice.authorityCode", { code: rec.inv_code })}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 text-sm">
      {rec?.status === "FAILED" && <StatusBadge tone="red" title={rec.error ?? ""}>{t("inputInvoices.einvoice.failed")}</StatusBadge>}
      {rec?.error && <span className="max-w-md truncate text-xs text-destructive" title={rec.error}>{rec.error}</span>}
      {active && (
        <Button size="sm" variant="outline" className="h-7 rounded-md border-primary text-primary hover:text-primary" disabled={publish.isPending} onClick={() => publish.mutate()} title={tc("legal.vietnameseOnly")}>
          <FileCheck2 className="size-4" /> {rec ? t("inputInvoices.einvoice.republish") : t("inputInvoices.einvoice.publish")}
        </Button>
      )}
    </span>
  );
}
