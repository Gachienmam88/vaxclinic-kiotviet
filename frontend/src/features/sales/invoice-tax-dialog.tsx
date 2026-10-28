"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTaxRates } from "@/features/products/product-queries";
import { api, errorMessage } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import { SUB_HEAD } from "./invoice-list-kit";
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
      <DialogContent className="gap-0 rounded-lg p-0 sm:max-w-[960px]">
        <DialogHeader className="px-5 pt-5 pb-4"><DialogTitle className="text-base font-bold">Sửa tỉ lệ thuế của hàng hóa</DialogTitle></DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto px-5 pb-4">
          <table className="w-full text-[13px]">
            <thead className={SUB_HEAD}><tr><th className="pl-2.5">Mã hàng</th><th>Tên hàng</th>
              <th className="w-24 text-right">GTGT (%)</th><th className="w-[340px]">Tỷ lệ thuế</th></tr></thead>
            <tbody>{invoice.lines.map((l) => {
              const vat = rates.find((r) => r.code === codes[l.id])?.vatRate;
              return (
                <tr key={l.id} className="border-b border-[#eff0f3] [&_td]:px-2 [&_td]:py-2">
                  <td className="text-primary">{l.productCode}</td><td>{l.productName} ({l.unitName})</td>
                  <td className="text-right">{vat == null ? "" : `${formatNumber(vat)}%`}</td>
                  <td>
                    <select className="h-[30px] w-full rounded-md border bg-background px-2 outline-none focus-visible:border-primary" aria-label={`Tỷ lệ thuế ${l.productCode}`}
                      value={codes[l.id]} onChange={(e) => setCodes({ ...codes, [l.id]: e.target.value })}>
                      <option value="">-- Chưa chọn --</option>
                      {rates.map((r) => <option key={r.id} value={r.code}>{r.name}</option>)}
                    </select></td>
                </tr>);
            })}</tbody>
          </table>
        </div>
        <DialogFooter className="m-0 rounded-b-lg border-t bg-background px-5 py-3">
          <Button variant="outline" className="h-8 rounded-md px-3" onClick={onClose}>Bỏ qua</Button>
          <Button className="h-8 rounded-md px-4" disabled={save.isPending} onClick={() => save.mutate()}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
