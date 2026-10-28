"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import type { IssueType, StockIssue } from "./inventory-types";
import { StockIssueEditor } from "./stock-issue-editor";
import { emptyIssue, issueEditorFromDoc, type IssueEditorState } from "./stock-issue-editor-state";

/** Trang soạn phiếu xuất: phiếu mới; ?edit=<id> = mở lại phiếu tạm. Dùng cho /inventory/damages/new và /internal-use/new. */
function NewStockIssue({ type }: { type: IssueType }) {
  const params = useSearchParams();
  const { data: me } = useCurrentUser();
  const [initial, setInitial] = useState<IssueEditorState | null>(null);
  const editId = params.get("edit");

  useEffect(() => {
    if (!me) return;
    const load = editId
      ? api<StockIssue>(`/stock-issues/${editId}?type=${type}`).then(issueEditorFromDoc)
      : Promise.resolve(emptyIssue(type, me.user.branches[0]?.id ?? ""));
    load.then(setInitial).catch((e) => toast.error(errorMessage(e)));
  }, [me, editId, type]);

  if (!initial) return <div className="p-6 text-sm text-muted-foreground">Đang tải...</div>;
  return <StockIssueEditor initial={initial} />;
}

export function StockIssueNewPage({ type }: { type: IssueType }) {
  return <Suspense><NewStockIssue type={type} /></Suspense>;
}
