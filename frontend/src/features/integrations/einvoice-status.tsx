"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileCheck2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";
import { useEInvoiceRecords, type EInvoiceRecord } from "./integration-queries";

/** Trạng thái HĐĐT + nút "Phát hành HĐĐT" trong chi tiết hóa đơn bán. Phát hành lại sau lỗi dùng lại RefID cũ (MISA chống trùng). */
export function EInvoiceStatus({ invoiceId, active }: { invoiceId: string; active: boolean }) {
  const qc = useQueryClient();
  const { data = [] } = useEInvoiceRecords([invoiceId]);
  const rec = data[0];
  const publish = useMutation({
    mutationFn: () => api<EInvoiceRecord>(`/einvoices/${invoiceId}/publish`, { method: "POST" }),
    onSuccess: (r) => {
      if (r.status === "PUBLISHED") toast.success(`Đã phát hành hóa đơn điện tử số ${r.inv_no}`);
      else toast.error(`Phát hành thất bại: ${r.error}`);
      qc.invalidateQueries({ queryKey: ["einvoices"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (rec?.status === "PUBLISHED") {
    return (
      <span className="flex items-center gap-2 text-sm">
        <Badge className="bg-green-100 text-green-700">Đã phát hành HĐĐT</Badge>
        Ký hiệu {rec.inv_series} · Số {rec.inv_no}{rec.inv_code && ` · Mã CQT ${rec.inv_code}`}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 text-sm">
      {rec?.status === "FAILED" && <Badge variant="destructive" title={rec.error ?? ""}>Phát hành lỗi</Badge>}
      {rec?.error && <span className="max-w-md truncate text-xs text-destructive" title={rec.error}>{rec.error}</span>}
      {active && (
        <Button size="sm" variant="outline" disabled={publish.isPending} onClick={() => publish.mutate()}>
          <FileCheck2 className="size-4" /> {rec ? "Phát hành lại" : "Phát hành HĐĐT"}
        </Button>
      )}
    </span>
  );
}
