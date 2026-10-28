"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { StockTakeEditor } from "@/features/inventory/stock-take-editor";
import { emptyTake, takeEditorFromDoc, type TakeEditorState } from "@/features/inventory/stock-take-editor-state";
import type { StockTake } from "@/features/inventory/inventory-types";

/** /inventory/stock-takes/new — phiếu kiểm kho mới; ?edit=<id> = mở lại phiếu tạm. */
function NewStockTake() {
  const params = useSearchParams();
  const tc = useT(commonNs);
  const { data: me } = useCurrentUser();
  const [initial, setInitial] = useState<TakeEditorState | null>(null);
  const editId = params.get("edit");

  useEffect(() => {
    if (!me) return;
    const load = editId
      ? api<StockTake>(`/stock-takes/${editId}`).then(takeEditorFromDoc)
      : Promise.resolve(emptyTake(me.user.branches[0]?.id ?? ""));
    load.then(setInitial).catch((e) => toast.error(errorMessage(e)));
  }, [me, editId]);

  if (!initial) return <div className="p-6 text-sm text-muted-foreground">{tc("status.loading")}</div>;
  return <StockTakeEditor initial={initial} />;
}

export default function NewStockTakePage() {
  return <Suspense><NewStockTake /></Suspense>;
}
