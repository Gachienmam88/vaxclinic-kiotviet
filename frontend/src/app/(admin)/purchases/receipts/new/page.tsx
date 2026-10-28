"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { PurchaseEditor } from "@/features/purchases/purchase-editor";
import { editorFromReceipt, emptyEditor, type EditorState } from "@/features/purchases/purchase-editor-state";
import type { Receipt } from "@/features/purchases/purchase-types";

/** /purchases/receipts/new — phiếu mới; ?copyFrom=<id> = sao chép; ?edit=<id> = mở phiếu tạm để sửa. */
function NewReceipt() {
  const params = useSearchParams();
  const { data: me } = useCurrentUser();
  const [initial, setInitial] = useState<EditorState | null>(null);
  const source = params.get("edit") ?? params.get("copyFrom");

  useEffect(() => {
    if (!me) return;
    if (!source) {
      setInitial(emptyEditor(me.user.branches[0]?.id ?? "", me.user.id));
      return;
    }
    api<Receipt>(`/purchase-receipts/${source}`)
      .then((r) => editorFromReceipt(r, !params.get("edit")))
      .then(setInitial)
      .catch((e) => toast.error(errorMessage(e)));
  }, [me, source, params]);

  if (!initial) return <div className="p-6 text-sm text-muted-foreground">Đang tải...</div>;
  return <PurchaseEditor mode="receipt" initial={initial} />;
}

export default function NewReceiptPage() {
  return <Suspense><NewReceipt /></Suspense>;
}
