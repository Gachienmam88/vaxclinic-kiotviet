"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/features/products/product-form-sections";
import { useTaxRates } from "@/features/products/product-queries";
import { api, errorMessage } from "@/lib/api-client";
import type { Invoice } from "./sales-types";

/** "Sửa tỉ lệ thuế của hàng hóa" trên 1 hóa đơn — dùng trước khi phát hành hóa đơn điện tử. */
export function InvoiceTaxDialog({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: rates = [] } = useTaxRates();
  const [codes, setCodes] = useState<Record<string, string>>(() =>
    Object.fromEntries(invoice.lines.map((l) => [l.id, l.taxCode ?? ""])));
  const save = useMutation({
    mutationFn: () => api(`/invoices/${invoice.id}/tax-codes`, { method: "PATCH",
      body: Object.entries(codes).map(([lineId, taxCode]) => ({ lineId, taxCode: taxCode || null })) }),
    onSuccess: () => { toast.success("Đã lưu tỷ lệ thuế"); qc.invalidateQueries({ queryKey: ["invoice", invoice.id] }); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader><DialogTitle>Sửa tỉ lệ thuế của hàng hóa</DialogTitle></DialogHeader>
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left"><tr><th className="px-2 py-2">Mã hàng</th><th className="px-2">Tên hàng</th>
            <th className="w-96 px-2">Tỷ lệ thuế</th></tr></thead>
          <tbody>{invoice.lines.map((l) => (
            <tr key={l.id} className="border-b">
              <td className="px-2 py-2 text-primary">{l.productCode}</td><td className="px-2">{l.productName} ({l.unitName})</td>
              <td className="px-2 py-1.5">
                <NativeSelect value={codes[l.id]} onChange={(e) => setCodes({ ...codes, [l.id]: e.target.value })}>
                  <option value="">-- Chưa chọn --</option>
                  {rates.map((r) => <option key={r.id} value={r.code}>{r.name}</option>)}
                </NativeSelect></td>
            </tr>))}</tbody>
        </table>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
