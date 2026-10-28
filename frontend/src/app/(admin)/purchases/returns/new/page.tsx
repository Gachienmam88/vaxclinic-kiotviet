"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { PurchaseEditor } from "@/features/purchases/purchase-editor";
import {
  editorFromReturn, emptyEditor, returnEditorFromReceipt, type EditorState,
} from "@/features/purchases/purchase-editor-state";
import type { PurchaseReturn, Receipt } from "@/features/purchases/purchase-types";

/** /purchases/returns/new — trả nhanh; ?receiptId=<id> = trả theo phiếu nhập; ?edit=<id> = sửa phiếu trả tạm. */
function NewReturn() {
  const params = useSearchParams();
  const { data: me } = useCurrentUser();
  const tc = useT(commonNs);
  const [initial, setInitial] = useState<EditorState | null>(null);
  const receiptId = params.get("receiptId");
  const editId = params.get("edit");

  useEffect(() => {
    if (!me) return;
    const load = editId
      ? api<PurchaseReturn>(`/purchase-returns/${editId}`).then(editorFromReturn)
      : receiptId
        ? api<Receipt>(`/purchase-receipts/${receiptId}`).then((r) => returnEditorFromReceipt(r, me.user.id))
        : Promise.resolve(emptyEditor(me.user.branches[0]?.id ?? "", me.user.id));
    load.then(setInitial).catch((e) => toast.error(errorMessage(e)));
  }, [me, receiptId, editId]);

  if (!initial) return <div className="p-6 text-sm text-muted-foreground">{tc("status.loading")}</div>;
  return <PurchaseEditor mode="return" initial={initial} />;
}

export default function NewReturnPage() {
  return <Suspense><NewReturn /></Suspense>;
}
