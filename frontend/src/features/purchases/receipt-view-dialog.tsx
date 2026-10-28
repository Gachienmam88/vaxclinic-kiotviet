"use client";

import { useRouter } from "next/navigation";
import { NotebookPen, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBranches } from "@/features/settings/settings-queries";
import { formatDateTime } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { DocStatusBadge } from "./purchase-list-chrome";
import { useReceipt } from "./purchase-queries";
import { receiptStatusLabels } from "./purchase-types";
import { ReceiptLinesTable, ReceiptSummary } from "./receipt-lines-table";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-[95px] shrink-0">{label}:</span><div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Popup "Phiếu nhập hàng" chỉ xem (mở từ mã phiếu nhập ở nơi khác, VD phiếu trả hàng nhập). */
export function ReceiptViewDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const router = useRouter();
  const { can } = useCurrentUser();
  const { data: r } = useReceipt(id);
  const { data: branches = [] } = useBranches();
  const t = useT(purchasesNs);
  const tc = useT(commonNs);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 rounded-lg p-0 sm:max-w-[960px]">
        <DialogHeader className="px-5 pt-5 pb-3"><DialogTitle className="text-base font-bold">{t("detail.receiptViewTitle")}</DialogTitle></DialogHeader>
        {!r ? <div className="p-6 text-muted-foreground">{tc("status.loading")}</div> : (
          <>
            <div className="space-y-4 overflow-y-auto px-5 pb-4 text-[13px]">
              <div className="flex items-center gap-3">
                <span>{r.code}</span>
                <DocStatusBadge status={r.status} label={receiptStatusLabels(t)[r.status]} />
                <span className="ml-auto">{branches.find((b) => b.id === r.branchId)?.name}</span>
              </div>
              <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 md:grid-cols-3">
                <Info label={tc("fields.createdBy")}>{r.createdByName}</Info>
                <Info label={t("receipts.receiver")}>{r.receiverName}</Info>
                <Info label={t("detail.receiveDate")}>{formatDateTime(r.receivedAt)}</Info>
                <Info label={t("detail.supplierName")}><span className="block truncate text-primary" title={r.supplierName ?? ""}>{r.supplierName ?? "—"}</span></Info>
                {r.inputInvoiceNo && <Info label={t("receipts.cols.inputInvoiceNo")}>{r.inputInvoiceNo}</Info>}
              </div>
              <ReceiptLinesTable r={r} />
              <div className="flex items-end gap-6">
                <p className="flex max-w-[520px] items-start gap-2 whitespace-pre-wrap">
                  <NotebookPen className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />{r.note || t("detail.notePlaceholder")}
                </p>
                <ReceiptSummary r={r} />
              </div>
            </div>
            {can("inventory.manage") && r.status === "DRAFT" && (
              <div className="flex justify-end border-t border-[#e5e7eb] px-5 py-3">
                <Button className="h-8 rounded-md px-3" onClick={() => router.push(`/purchases/receipts/new?edit=${r.id}`)}>
                  <Share className="size-4" /> {t("detail.openDoc")}</Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
