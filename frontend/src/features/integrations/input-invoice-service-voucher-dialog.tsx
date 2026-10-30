"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { kvDialog, kvDialogBody, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn, kvInput, kvLabel } from "@/features/sales/customer-ui-primitives";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { linkInputInvoice, type InputInvoice } from "./integration-queries";
import { useT } from "@/lib/i18n";
import { inputInvoicesNs } from "@/messages/input-invoices";

/** Loại chi cố định của phiếu chi lập từ hóa đơn dịch vụ (Sổ quỹ → Loại thu chi). */
export const SERVICE_CATEGORY = "Chi mua dịch vụ";

/**
 * "Phiếu mua dịch vụ": phiếu chi tiền mặt ở Sổ quỹ, loại "Chi mua dịch vụ", số tiền = tổng hóa đơn, có hạch toán (chi phí).
 * Người nhận ghi "Khác" + tên / MST người bán: Sổ quỹ chặn phiếu chi tay cho NCC (công nợ NCC chỉ ghi ở màn Nhà cung cấp).
 */
export function InputInvoiceServiceVoucherDialog({ inv, onClose }: { inv: InputInvoice; onClose: () => void }) {
  const qc = useQueryClient();
  const t = useT(inputInvoicesNs);
  const { data: me } = useCurrentUser();
  const [note, setNote] = useState(`Hóa đơn đầu vào ${inv.templateNo ?? ""}${inv.series} số ${inv.number}`);
  const partner = `${inv.sellerName ?? ""} - ${inv.sellerTaxCode}`;
  const save = useMutation({
    mutationFn: async () => {
      const v = await api<{ id: string; code: string }>("/cashbook", { method: "POST", body: {
        voucherType: "PAYMENT", fund: "CASH", category: SERVICE_CATEGORY, amount: Number(inv.total), branchId: me?.user.branches[0]?.id,
        partnerType: "OTHER", partnerName: partner, accounting: true, note } });
      await linkInputInvoice(inv.id, "CASH_VOUCHER", v.id, v.code)
        .catch((e) => toast.error(t("create.linkFailed", { error: errorMessage(e) })));
      return v;
    },
    onSuccess: (v) => {
      toast.success(t("service.toast", { code: v.code }));
      qc.invalidateQueries({ queryKey: ["input-invoices"] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 border-b border-[#eff0f3] py-1.5 text-[13px]"><span>{label}</span><span className="text-right font-medium">{value}</span></div>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(kvDialog, "sm:max-w-[480px]")}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>{t("service.title")}</DialogTitle></DialogHeader>
        <div className={kvDialogBody}>
          {row(t("service.fund"), t("service.fundCash"))}
          {row(t("service.category"), SERVICE_CATEGORY)}
          {row(t("service.partner"), partner)}
          {row(t("service.amount"), formatMoney(inv.total))}
          <div className="grid gap-1.5"><Label className={kvLabel} htmlFor="service-note">{t("service.note")}</Label>
            <Input id="service-note" className={kvInput} value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{t("common.skip")}</Button>
          <Button className={kvFooterBtn} disabled={save.isPending || !me?.user.branches.length} onClick={() => save.mutate()}>{t("service.submit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
