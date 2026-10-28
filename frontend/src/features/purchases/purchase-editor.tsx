"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";
import { useUserLookup } from "./purchase-queries";
import { toRequest, type EditorMode, type EditorState } from "./purchase-editor-state";
import { PurchaseEditorPanel } from "./purchase-editor-panel";
import { lineFromProduct } from "./purchase-line-form";
import { PurchaseLineTable } from "./purchase-line-table";
import { ProductPicker } from "./search-pickers";
import { SupplierFormDialog } from "./supplier-form-dialog";

const CONFIG = {
  receipt: { title: "Nhập hàng", endpoint: "/purchase-receipts", listPath: "/purchases/receipts", listKey: "purchase-receipts" },
  return: { title: "Trả hàng nhập", endpoint: "/purchase-returns", listPath: "/purchases/returns", listKey: "purchase-returns" },
} as const;

/** Màn soạn phiếu nhập / trả hàng nhập (trang toàn màn hình như màn nhập hàng). */
export function PurchaseEditor({ mode, initial }: { mode: EditorMode; initial: EditorState }) {
  const cfg = CONFIG[mode];
  const router = useRouter();
  const qc = useQueryClient();
  const { data: users = [] } = useUserLookup();
  const [state, setState] = useState(initial);
  const [supplierDialog, setSupplierDialog] = useState(false);
  const set = (p: Partial<EditorState>) => setState((s) => ({ ...s, ...p }));

  const save = useMutation({
    mutationFn: (complete: boolean) => {
      const personName = users.find((u) => u.id === state.personId)?.fullName ?? "";
      const body = toRequest(mode, state, personName);
      const url = state.id ? `${cfg.endpoint}/${state.id}` : cfg.endpoint;
      return api<{ id: string; code: string }>(`${url}?complete=${complete}`, { method: state.id ? "PUT" : "POST", body });
    },
    onSuccess: (doc, complete) => {
      toast.success(`${complete ? "Đã hoàn thành" : "Đã lưu tạm"} phiếu ${doc.code}`);
      qc.invalidateQueries({ queryKey: [cfg.listKey] });
      qc.invalidateQueries({ queryKey: ["products"] });
      router.push(cfg.listPath);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function submit(complete: boolean) {
    if (!state.lines.length) return toast.error("Phiếu chưa có hàng hóa");
    if (complete) {
      const missing = state.lines.find((l) => l.lotManaged && (!l.lotNumber || (mode === "receipt" && !l.expiryDate)));
      if (missing) return toast.error(`${missing.productName}: nhập ${mode === "receipt" ? "số lô và hạn sử dụng" : "lô trả"}`);
    }
    save.mutate(complete);
  }

  return (
    <div className="flex gap-4">
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push(cfg.listPath)} aria-label="Quay lại"><ArrowLeft /></Button>
          <h1 className="text-xl font-bold">{cfg.title}</h1>
          {!state.receiptId && (
            <ProductPicker onPick={(p) => set({ lines: [...state.lines, lineFromProduct(p)] })} />
          )}
        </div>
        <div className="min-h-[60vh] overflow-x-auto rounded-lg bg-background">
          <PurchaseLineTable mode={mode} lines={state.lines} branchId={state.branchId} onChange={(lines) => set({ lines })} />
          {!state.lines.length && (
            <div className="py-24 text-center text-sm text-muted-foreground">
              Tìm hàng hóa theo mã hoặc tên (phím F3) để thêm vào phiếu
            </div>
          )}
        </div>
      </div>
      <aside className="flex w-80 shrink-0 flex-col gap-3 rounded-lg bg-background p-4">
        <PurchaseEditorPanel mode={mode} state={state} set={set} onCreateSupplier={() => setSupplierDialog(true)} />
        <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
          <Button variant="outline" className="h-11 border-primary text-primary" disabled={save.isPending} onClick={() => submit(false)}>
            Lưu tạm
          </Button>
          <Button className="h-11" disabled={save.isPending} onClick={() => submit(true)}>Hoàn thành</Button>
        </div>
      </aside>
      {supplierDialog && (
        <SupplierFormDialog onClose={() => setSupplierDialog(false)}
          onSaved={(s) => set({ supplier: { id: s.id, name: s.name } })} />
      )}
    </div>
  );
}
