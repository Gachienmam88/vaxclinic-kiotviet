"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DETAIL_BTN, StatusBadge } from "@/features/sales/invoice-list-kit";
import { api, errorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { useTaxConnections, type TaxConnection } from "./integration-queries";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

const PORTAL = "https://hoadondientu.gdt.gov.vn/";

/** Tab "Danh sách kết nối": thẻ từng kết nối cổng thuế (MST, tài khoản, đồng bộ lần cuối, sửa / xóa). */
export function TaxConnectionList({ onEdit }: { onEdit: (c: TaxConnection) => void }) {
  const qc = useQueryClient();
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  const { data = [] } = useTaxConnections();
  const remove = useMutation({
    mutationFn: (id: string) => api(`/tax-connections/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tax-connections"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="space-y-3 text-[13px]">
      <p className="flex items-center justify-center gap-2 rounded bg-primary-tint px-3 py-1.5 text-primary">
        <Info className="size-4 shrink-0" /> {t("inputInvoices.connections.note")}</p>
      {!data.length && <p className="py-8 text-center text-muted-foreground">{t("inputInvoices.connections.empty")}</p>}
      {data.map((c) => (
        <div key={c.id} className="rounded-lg border bg-background px-5 py-4">
          <div className="flex items-center gap-2 font-semibold">{t("inputInvoices.connections.cardTitle")}
            <StatusBadge tone={c.lastError ? "red" : "green"}>{c.lastError ? t("inputInvoices.connections.syncError") : tc("status.active")}</StatusBadge></div>
          <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 md:grid-cols-4">
            <Field label={t("inputInvoices.connections.website")}><a href={PORTAL} target="_blank" rel="noreferrer" className="text-primary hover:underline">{PORTAL}</a></Field>
            <Field label={t("inputInvoices.filter.taxCode")}>{c.taxCode}</Field>
            <Field label={t("inputInvoices.connections.username")}>{c.username}</Field>
            <Field label={t("inputInvoices.connections.password")}>******</Field>
          </div>
          {c.lastError && <p className="mt-2 text-xs text-destructive">{c.lastError}</p>}
          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t pt-2.5">
            <span>{t("inputInvoices.connections.lastSync", { time: c.lastSyncedAt ? formatDateTime(c.lastSyncedAt) : t("inputInvoices.connections.neverSynced") })}</span>
            <Button variant="outline" className={`${DETAIL_BTN} ml-auto`} onClick={() => onEdit(c)}><Pencil className="size-3.5" /> {t("inputInvoices.connections.editSettings")}</Button>
            <Button variant="outline" className={DETAIL_BTN} onClick={() => confirm(t("inputInvoices.connections.confirmDelete", { taxCode: c.taxCode })) && remove.mutate(c.id)}>
              <Trash2 className="size-3.5" /> {tc("actions.delete")}</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2 border-b pb-2"><div className="text-xs">{label}</div><div className="truncate">{children}</div></div>;
}
