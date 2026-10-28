"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { PurchaseEditor } from "@/features/purchases/purchase-editor";
import { editorFromReceipt, emptyEditor, type EditorState } from "@/features/purchases/purchase-editor-state";
import type { Receipt } from "@/features/purchases/purchase-types";
import type { InputInvoice } from "@/features/integrations/integration-queries";
import { receiptEditorFromInputInvoice } from "@/features/integrations/receipt-from-input-invoice";

/** /purchases/receipts/new — phiếu mới; ?copyFrom=<id> = sao chép; ?edit=<id> = mở phiếu tạm để sửa. */
function NewReceipt() {
  const params = useSearchParams();
  const { data: me } = useCurrentUser();
  const tc = useT(commonNs);
  const [initial, setInitial] = useState<EditorState | null>(null);
  const [reference, setReference] = useState<InputInvoice | undefined>();
  const source = params.get("edit") ?? params.get("copyFrom");
  const fromInputInvoice = params.get("fromInputInvoice");

  useEffect(() => {
    if (!me) return;
    if (fromInputInvoice) {
      receiptEditorFromInputInvoice(fromInputInvoice, me.user.branches[0]?.id ?? "", me.user.id)
        .then((r) => { setReference(r.reference); setInitial(r.state); })
        .catch((e) => toast.error(errorMessage(e)));
      return;
    }
    if (!source) {
      setInitial(emptyEditor(me.user.branches[0]?.id ?? "", me.user.id));
      return;
    }
    api<Receipt>(`/purchase-receipts/${source}`)
      .then((r) => editorFromReceipt(r, !params.get("edit")))
      .then(setInitial)
      .catch((e) => toast.error(errorMessage(e)));
  }, [me, source, params, fromInputInvoice]);

  if (!initial) return <div className="p-6 text-sm text-muted-foreground">{tc("status.loading")}</div>;
  return <PurchaseEditor mode="receipt" initial={initial} reference={reference} />;
}

export default function NewReceiptPage() {
  return <Suspense><NewReceipt /></Suspense>;
}
