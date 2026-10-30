"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { PurchaseEditor } from "@/features/purchases/purchase-editor";
import { editorFromReceipt, emptyEditor, linesFromDoc, type EditorState } from "@/features/purchases/purchase-editor-state";
import type { Receipt } from "@/features/purchases/purchase-types";
import { loadInputInvoiceReceiptDraft } from "@/features/integrations/input-invoice-receipt-draft";

/**
 * /purchases/receipts/new — phiếu mới; ?copyFrom=<id> = sao chép; ?edit=<id> = mở phiếu tạm (sửa) hoặc phiếu đã nhập
 * (chỉ Lưu); ?source=inputInvoice&id=<hóa đơn đầu vào> = phiếu nhập từ màn "Xác nhận dữ liệu từ hóa đơn điện tử".
 */
async function fromInputInvoice(invoiceId: string, branchId: string, personId: string): Promise<EditorState> {
  const d = await loadInputInvoiceReceiptDraft(invoiceId);
  const lines = await linesFromDoc(d.lines.map((l) => ({ ...l, lotNumber: null })));
  return { ...emptyEditor(branchId, personId), supplier: d.supplier, inputInvoiceNo: d.inputInvoiceNo, inputInvoiceId: invoiceId,
    note: d.note, lines };
}

function NewReceipt() {
  const params = useSearchParams();
  const { data: me } = useCurrentUser();
  const tc = useT(commonNs);
  const [initial, setInitial] = useState<EditorState | null>(null);
  const source = params.get("edit") ?? params.get("copyFrom");
  const invoiceId = params.get("source") === "inputInvoice" ? params.get("id") : null;

  useEffect(() => {
    if (!me) return;
    const branchId = me.user.branches[0]?.id ?? "";
    const load = invoiceId ? fromInputInvoice(invoiceId, branchId, me.user.id)
      : source ? api<Receipt>(`/purchase-receipts/${source}`).then((r) => editorFromReceipt(r, !params.get("edit")))
        : Promise.resolve(emptyEditor(branchId, me.user.id));
    load.then(setInitial).catch((e) => toast.error(errorMessage(e)));
  }, [me, source, params, invoiceId]);

  if (!initial) return <div className="p-6 text-sm text-muted-foreground">{tc("status.loading")}</div>;
  return <PurchaseEditor mode="receipt" initial={initial} />;
}

export default function NewReceiptPage() {
  return <Suspense><NewReceipt /></Suspense>;
}
