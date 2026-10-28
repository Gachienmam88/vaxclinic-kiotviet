"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NumberInput } from "@/components/number-input";
import { kvDialog, kvDialogFooter, kvDialogHeader, kvDialogTitle, kvFooterBtn, kvInput } from "@/features/sales/customer-ui-primitives";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { fromLocalInput } from "./purchase-line-form";
import { useInvalidateSuppliers } from "./supplier-queries";
import type { SupplierRow } from "./supplier-types";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

/** Popup "Điều chỉnh" công nợ NCC: nhập giá trị nợ mới → phát sinh điều chỉnh = nợ mới − nợ hiện tại. */
export function SupplierAdjustDialog({ supplier, onClose }: { supplier: SupplierRow; onClose: () => void }) {
  const invalidate = useInvalidateSuppliers();
  const { data: me } = useCurrentUser();
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  const [at, setAt] = useState("");
  const [value, setValue] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: () => api<{ code: string }>(`/suppliers/${supplier.id}/adjustments`, { method: "POST", body: {
      branchId: me?.user.branches[0]?.id, occurredAt: at ? fromLocalInput(at) : null, newDebt: value, note } }),
    onSuccess: (d) => { toast.success(t("suppliers.adjust.toastDone", { code: d.code })); invalidate(); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  // Nút "Chỉnh sửa" chỉ bật khi đã nhập giá trị khác nợ hiện tại (như KiotViet)
  const valid = value !== null && value !== Number(supplier.debt) && !save.isPending;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cn(kvDialog, "sm:max-w-[497px]")}>
        <DialogHeader className={kvDialogHeader}><DialogTitle className={kvDialogTitle}>{t("suppliers.adjust.title")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-[126px_1fr] items-center gap-x-2 gap-y-3 px-5 pt-3 pb-6 text-[13px]">
          <span>{t("suppliers.adjust.currentDebt")}</span><span>{formatMoney(supplier.debt)}</span>
          <span>{t("suppliers.adjust.date")}</span>
          <DateTimePicker aria-label={t("suppliers.adjust.date")} className={kvInput} value={at} onChange={(v) => setAt(v)} />
          <span>{t("suppliers.adjust.value")}</span>
          <NumberInput autoFocus aria-label={t("suppliers.adjust.value")} className={kvInput} value={value ?? 0}
            onValueChange={(v) => setValue(v)} />
          <span className="self-start pt-1.5">{t("suppliers.adjust.description")}</span>
          <div className="relative"><Pencil className="absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" />
            <textarea aria-label={tc("fields.description")} className="min-h-[58px] w-full rounded-md border border-[#d9dbe0] px-2.5 py-1.5 pl-8 text-[13px] outline-none focus:border-primary"
              value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter className={kvDialogFooter}>
          <Button variant="outline" className={kvFooterBtn} onClick={onClose}>{tc("actions.skip")}</Button>
          <Button className={kvFooterBtn} disabled={!valid} onClick={() => save.mutate()}>{t("suppliers.info.edit")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
