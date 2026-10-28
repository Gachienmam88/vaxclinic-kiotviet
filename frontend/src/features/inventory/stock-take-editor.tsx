"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import type { ProductDetail } from "@/features/products/product-types";
import { useBranches } from "@/features/settings/settings-queries";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import { InventoryEditorShell, PANEL_FIELD, PanelRow } from "./inventory-editor-shell";
import {
  newLotRow, rowsForProduct, tabOf, takeRequest, takeTotals, type TakeEditorState, type TakeTab,
} from "./stock-take-editor-state";
import { StockTakeLineTable } from "./stock-take-line-table";

const TABS: [TakeTab, string][] = [["all", "Tất cả"], ["match", "Khớp"], ["diff", "Lệch"], ["unchecked", "Chưa kiểm"]];
const LIST = "/inventory/stock-takes";

/** Màn kiểm kho toàn trang: chọn hàng (hàng theo lô → mỗi lô 1 dòng), nhập thực tế, Lưu tạm / Hoàn thành (cân bằng kho). */
export function StockTakeEditor({ initial }: { initial: TakeEditorState }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const { data: branches = [] } = useBranches();
  const [state, setState] = useState(initial);
  const [tab, setTab] = useState<TakeTab>("all");
  const [lastLotProduct, setLastLotProduct] = useState<ProductDetail | null>(null);
  const set = (p: Partial<TakeEditorState>) => setState((s) => ({ ...s, ...p }));
  const myBranches = branches.filter((b) => me?.user.branches.some((x) => x.id === b.id));
  const t = takeTotals(state.rows);

  async function pick(p: ProductDetail) {
    try {
      const added = await rowsForProduct(p, state.branchId, state.rows);
      if (!added.length) toast.info(`${p.name} đã có trên phiếu`);
      setState((s) => ({ ...s, rows: [...s.rows, ...added] }));
      if (p.lotManaged) setLastLotProduct(p);
    } catch (e) { toast.error(errorMessage(e)); }
  }

  const save = useMutation({
    mutationFn: (complete: boolean) => {
      const url = state.id ? `/stock-takes/${state.id}` : "/stock-takes";
      return api<{ id: string; code: string }>(`${url}?complete=${complete}`, { method: state.id ? "PUT" : "POST", body: takeRequest(state) });
    },
    onSuccess: (doc, complete) => {
      toast.success(`${complete ? "Đã cân bằng kho" : "Đã lưu tạm"} phiếu ${doc.code}`);
      qc.invalidateQueries({ queryKey: ["stock-takes"] });
      qc.invalidateQueries({ queryKey: ["stock-take", doc.id] });
      qc.invalidateQueries({ queryKey: ["products"] });
      router.push(LIST);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function submit(complete: boolean) {
    if (!state.rows.length) return toast.error("Phiếu chưa có hàng hóa");
    const badLot = state.rows.find((r) => r.lotManaged && (!r.lotNumber.trim() || (r.newLot && r.actual && !r.expiryDate)));
    if (badLot) return toast.error(`${badLot.productName}: nhập số lô và hạn sử dụng`);
    if (complete) {
      const unchecked = state.rows.filter((r) => r.actual == null).length;
      if (unchecked === state.rows.length) return toast.error("Chưa nhập số lượng thực tế cho hàng nào");
      if (!confirm(`Cân bằng kho theo số thực tế?${unchecked ? ` ${unchecked} dòng chưa kiểm sẽ giữ nguyên tồn.` : ""} Phiếu đã cân bằng không sửa / hủy được.`)) return;
    }
    save.mutate(complete);
  }

  const count = (k: TakeTab) => (k === "all" ? state.rows.length : state.rows.filter((r) => tabOf(r) === k).length);
  return (
    <InventoryEditorShell title="Kiểm kho" listPath={LIST} onPick={pick} empty={!state.rows.length}
      saving={save.isPending} onSave={submit}
      toolbar={state.rows.length > 0 && (
        <div className="flex items-center gap-1.5">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={cn("h-[30px] rounded-md border px-3 text-[13px]", tab === k ? "border-primary bg-primary-tint-light font-medium text-primary" : "border-[#d1d5db] bg-background")}>
              {label} ({count(k)})
            </button>
          ))}
          {lastLotProduct && (
            <button type="button" className="ml-auto flex items-center gap-1 text-[13px] text-primary hover:underline"
              onClick={() => set({ rows: [...state.rows, newLotRow(lastLotProduct)] })}>
              <Plus className="size-4" /> Thêm lô mới cho {lastLotProduct.name}
            </button>
          )}
        </div>
      )}
      panel={(
        <div className="space-y-1.5">
          {myBranches.length > 1 && (
            <select aria-label="Chi nhánh" className={cn(PANEL_FIELD, "mb-2.5")} value={state.branchId} disabled={state.rows.length > 0}
              title={state.rows.length ? "Xóa hết dòng để đổi chi nhánh" : undefined} onChange={(e) => set({ branchId: e.target.value })}>
              {myBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <PanelRow label="Mã kiểm kho">
            <div className={cn(PANEL_FIELD, "flex items-center text-left", !state.code && "text-muted-foreground")}>{state.code ?? "Mã phiếu tự động"}</div>
          </PanelRow>
          <PanelRow label="Trạng thái"><span className="block text-left">Phiếu tạm</span></PanelRow>
          <PanelRow label="Tổng SL thực tế">{formatNumber(t.actualQty)}</PanelRow>
          <PanelRow label="SL lệch tăng"><span className="text-[#0d9f4f]">{formatNumber(t.increase)}</span></PanelRow>
          <PanelRow label="SL lệch giảm"><span className="text-destructive">{formatNumber(t.decrease)}</span></PanelRow>
          <PanelRow label="Tổng chênh lệch" strong><span className="font-bold text-primary">{formatMoney(t.diffValue)}</span></PanelRow>
          <Textarea aria-label="Ghi chú" className="mt-2.5 min-h-[58px] rounded-md" placeholder="Ghi chú" value={state.note}
            onChange={(e) => set({ note: e.target.value })} />
        </div>
      )}>
      <StockTakeLineTable rows={state.rows} tab={tab} onChange={(rows) => set({ rows })} />
    </InventoryEditorShell>
  );
}
