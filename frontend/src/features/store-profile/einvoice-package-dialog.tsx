"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney, parseNumber } from "@/lib/format";
import { FlowFooter } from "./store-flow-parts";

export type PackageUsage = {
  id: string; name: string; quantity: number; used: number; remaining: number; startDate: string; endDate: string;
  status: "NOT_STARTED" | "ACTIVE" | "EXPIRED";
};

export type EInvoiceSummary = {
  account: string | null; configured: boolean; issuer: string; totalQuantity: number; published: number; remaining: number;
  unallocated: number; serviceExpiry: string | null; packages: PackageUsage[];
};

export const EINVOICE_SUMMARY_KEY = ["store-profile", "einvoice"];

/** Thêm / sửa / xóa gói hóa đơn rồi làm mới bảng (server trả lại toàn bộ tổng hợp). */
export function usePackageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ method, id, body }: { method: "POST" | "PUT" | "DELETE"; id?: string; body?: unknown }) =>
      api<EInvoiceSummary>(`/store-profile/einvoice/packages${id ? `/${id}` : ""}`, { method, body }),
    onSuccess: (data) => { qc.setQueryData(EINVOICE_SUMMARY_KEY, data); toast.success("Đã lưu gói hóa đơn"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

/** Nhập gói hóa đơn đã mua của nhà phát hành (tên, số HĐĐT, thời hạn). */
export function EInvoicePackageDialog({ pkg, onClose }: { pkg: PackageUsage | null; onClose: () => void }) {
  const [f, setF] = useState({ name: pkg?.name ?? "", quantity: pkg ? String(pkg.quantity) : "", startDate: pkg?.startDate ?? "", endDate: pkg?.endDate ?? "" });
  const save = usePackageMutation();
  const qty = parseNumber(f.quantity) ?? 0;
  const valid = !!f.name.trim() && qty > 0 && !!f.startDate && !!f.endDate && f.endDate >= f.startDate;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-3 sm:max-w-[480px]">
        <DialogHeader><DialogTitle className="text-[17px] font-semibold">{pkg ? "Sửa gói hóa đơn" : "Thêm gói hóa đơn"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <label className="col-span-2 grid gap-1"><span className="text-xs text-muted-foreground">Tên gói *</span>
            <Input autoFocus value={f.name} maxLength={100} placeholder="VD: Gói 5.000 hóa đơn 2026" onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label className="col-span-2 grid gap-1"><span className="text-xs text-muted-foreground">Tổng số HĐĐT *</span>
            <Input inputMode="numeric" value={f.quantity} onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); setF({ ...f, quantity: d ? formatMoney(d) : "" }); }} /></label>
          <label className="grid gap-1"><span className="text-xs text-muted-foreground">Ngày bắt đầu *</span>
            <DatePicker value={f.startDate} onChange={(v) => setF({ ...f, startDate: v })} /></label>
          <label className="grid gap-1"><span className="text-xs text-muted-foreground">Ngày hết hạn *</span>
            <DatePicker value={f.endDate} min={f.startDate || undefined} onChange={(v) => setF({ ...f, endDate: v })} /></label>
        </div>
        <FlowFooter onCancel={onClose} nextLabel="Lưu" disabled={!valid || save.isPending}
          onNext={() => save.mutate({ method: pkg ? "PUT" : "POST", id: pkg?.id,
            body: { name: f.name.trim(), quantity: qty, startDate: f.startDate, endDate: f.endDate } }, { onSuccess: onClose })} />
      </DialogContent>
    </Dialog>
  );
}
