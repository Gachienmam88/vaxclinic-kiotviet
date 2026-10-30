"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api-client";
import type { TaxConnection } from "./integration-queries";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

const PORTAL = "https://hoadondientu.gdt.gov.vn";

/** Thêm / sửa kết nối cổng hóa đơn điện tử của cơ quan thuế (MST + tài khoản + mật khẩu). */
export function TaxConnectionDialog({ connection, onClose }: { connection?: TaxConnection; onClose: () => void }) {
  const qc = useQueryClient();
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  const [f, setF] = useState({ taxCode: connection?.taxCode ?? "", username: connection?.username ?? "", password: "" });
  const save = useMutation({
    mutationFn: () => connection
      ? api(`/tax-connections/${connection.id}`, { method: "PUT", body: f })
      : api("/tax-connections", { method: "POST", body: f }),
    onSuccess: () => { toast.success(t("inputInvoices.dialog.toastSaved")); qc.invalidateQueries({ queryKey: ["tax-connections"] }); onClose(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-lg p-5 sm:max-w-md">
        <DialogHeader><DialogTitle className="text-base font-bold">{connection ? t("inputInvoices.dialog.editTitle") : t("inputInvoices.dialog.addTitle")}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{t("inputInvoices.dialog.hint", { portal: PORTAL })}</p>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>{t("inputInvoices.filter.taxCode")}</Label><Input value={f.taxCode} onChange={(e) => setF({ ...f, taxCode: e.target.value, username: f.username || e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>{t("inputInvoices.connections.username")}</Label><Input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} /></div>
          <div className="grid gap-1.5"><Label>{t("inputInvoices.connections.password")} {connection && t("inputInvoices.dialog.passwordKeep")}</Label>
            <Input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        </div>
        <DialogFooter className="-mx-5 -mb-5 rounded-b-lg bg-background px-5 py-3">
          <Button variant="outline" className="h-8 rounded-md px-3" onClick={onClose}>{tc("actions.skip")}</Button>
          <Button className="h-8 rounded-md px-4" disabled={save.isPending || !f.taxCode || !f.username || (!connection && !f.password)} onClick={() => save.mutate()}>{tc("actions.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
