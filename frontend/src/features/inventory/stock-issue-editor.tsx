"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { lineFromProduct } from "@/features/purchases/purchase-line-form";
import { useBranches } from "@/features/settings/settings-queries";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { InventoryEditorShell, PANEL_FIELD, PanelRow } from "./inventory-editor-shell";
import { ISSUE_CONFIG } from "./inventory-types";
import { issueLineValue, issueRequest, type IssueEditorState } from "./stock-issue-editor-state";
import { StockIssueLineTable } from "./stock-issue-line-table";

/** Màn soạn phiếu xuất hủy / xuất dùng nội bộ (toàn trang như Nhập hàng). Hoàn thành = trừ kho theo giá vốn. */
export function StockIssueEditor({ initial }: { initial: IssueEditorState }) {
  const cfg = ISSUE_CONFIG[initial.type];
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const { data: branches = [] } = useBranches();
  const [state, setState] = useState(initial);
  const set = (p: Partial<IssueEditorState>) => setState((s) => ({ ...s, ...p }));
  const myBranches = branches.filter((b) => me?.user.branches.some((x) => x.id === b.id));
  const qty = state.lines.reduce((n, l) => n + l.quantity, 0);
  const value = state.lines.reduce((n, l) => n + issueLineValue(l), 0);

  const save = useMutation({
    mutationFn: (complete: boolean) => {
      const url = state.id ? `/stock-issues/${state.id}` : "/stock-issues";
      return api<{ id: string; code: string }>(`${url}?type=${state.type}&complete=${complete}`,
        { method: state.id ? "PUT" : "POST", body: issueRequest(state) });
    },
    onSuccess: (doc, complete) => {
      toast.success(`${complete ? "Đã hoàn thành" : "Đã lưu tạm"} phiếu ${doc.code}`);
      qc.invalidateQueries({ queryKey: ["stock-issues", state.type] });
      qc.invalidateQueries({ queryKey: ["stock-issue", doc.id] });
      qc.invalidateQueries({ queryKey: ["products"] });
      router.push(cfg.listPath);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function submit(complete: boolean) {
    if (!state.lines.length) return toast.error("Phiếu chưa có hàng hóa");
    if (state.lines.some((l) => l.quantity <= 0)) return toast.error("Số lượng phải lớn hơn 0");
    if (complete) {
      const missing = state.lines.find((l) => l.lotManaged && !l.lotNumber);
      if (missing) return toast.error(`${missing.productName}: chọn lô xuất`);
    }
    save.mutate(complete);
  }

  return (
    <InventoryEditorShell title={cfg.title} listPath={cfg.listPath} empty={!state.lines.length} saving={save.isPending}
      onSave={submit} onPick={(p) => set({ lines: [...state.lines, lineFromProduct(p)] })}
      panel={(
        <div className="space-y-1.5">
          <input type="datetime-local" aria-label="Thời gian" className={cn(PANEL_FIELD, "mb-2.5")} value={state.at}
            onChange={(e) => set({ at: e.target.value })} />
          {myBranches.length > 1 && (
            <select aria-label="Chi nhánh" className={cn(PANEL_FIELD, "mb-2.5")} value={state.branchId}
              disabled={state.lines.some((l) => l.lotNumber)} onChange={(e) => set({ branchId: e.target.value })}>
              {myBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <PanelRow label={cfg.codeLabel}>
            <div className={cn(PANEL_FIELD, "flex items-center text-left", !state.code && "text-muted-foreground")}>{state.code ?? "Mã phiếu tự động"}</div>
          </PanelRow>
          <PanelRow label="Trạng thái"><span className="block text-left">Phiếu tạm</span></PanelRow>
          <PanelRow label="Lý do">
            <input aria-label="Lý do" className={PANEL_FIELD} maxLength={250} value={state.reason}
              placeholder={state.type === "DAMAGE" ? "VD: Hết hạn sử dụng" : "VD: Dùng tại phòng tiêm"}
              onChange={(e) => set({ reason: e.target.value })} />
          </PanelRow>
          <PanelRow label="Tổng số lượng">{formatNumber(qty)}</PanelRow>
          <PanelRow label={cfg.valueLabel} strong><span className="font-bold text-primary">{formatMoney(value)}</span></PanelRow>
          <Textarea aria-label="Ghi chú" className="mt-2.5 min-h-[58px] rounded-md" placeholder="Ghi chú" value={state.note}
            onChange={(e) => set({ note: e.target.value })} />
        </div>
      )}>
      <StockIssueLineTable type={state.type} lines={state.lines} branchId={state.branchId} onChange={(lines) => set({ lines })} />
    </InventoryEditorShell>
  );
}
