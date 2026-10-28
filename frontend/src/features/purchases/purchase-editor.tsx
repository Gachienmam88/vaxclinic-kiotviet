"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";
import { formatMoney, formatNumber } from "@/lib/format";
import type { InputInvoice } from "@/features/integrations/integration-queries";
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

/**
 * Màn soạn phiếu nhập / trả hàng nhập (trang toàn màn hình như màn nhập hàng).
 * reference: hóa đơn đầu vào đang lập phiếu → hiện dòng hàng để đối chiếu, lưu xong gắn "đã lập phiếu".
 */
export function PurchaseEditor({ mode, initial, reference }: { mode: EditorMode; initial: EditorState; reference?: InputInvoice }) {
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
    onSuccess: async (doc, complete) => {
      toast.success(`${complete ? "Đã hoàn thành" : "Đã lưu tạm"} phiếu ${doc.code}`);
      if (reference) {
        await api(`/input-invoices/${reference.id}/receipt`, { method: "PATCH", body: { receiptId: doc.id, receiptCode: doc.code } })
          .catch((e) => toast.error(`Chưa gắn được phiếu vào hóa đơn đầu vào: ${errorMessage(e)}`));
        qc.invalidateQueries({ queryKey: ["input-invoices"] });
      }
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
    <div className="flex min-h-[calc(100vh-110px)] gap-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex h-8 items-center gap-2.5">
          <Button variant="ghost" size="icon-sm" onClick={() => router.push(cfg.listPath)} aria-label="Quay lại"><ArrowLeft /></Button>
          <h1 className="text-lg font-bold">{cfg.title}</h1>
          {!state.receiptId && (
            <ProductPicker onPick={(p) => set({ lines: [...state.lines, lineFromProduct(p)] })} />
          )}
        </div>
        {reference && (
          <details open className="rounded-lg border border-primary/30 bg-primary-tint-light p-3 text-[13px]">
            <summary className="cursor-pointer font-medium">
              Hóa đơn đầu vào {reference.series} số {reference.number} — {reference.sellerName} — {formatMoney(reference.total)} (đối chiếu để chọn hàng)
            </summary>
            <table className="mt-2 w-full"><tbody>{reference.lines.map((l, n) => (
              <tr key={n} className="border-b border-primary/10"><td className="py-1">{l.name}</td><td>{l.unit}</td>
                <td className="text-right">{formatNumber(l.quantity)}</td><td className="text-right">{formatNumber(l.unitPrice)}</td>
                <td className="pl-3">{l.vatRate}</td><td className="text-right">{formatMoney(l.amount)}</td></tr>))}</tbody></table>
          </details>
        )}
        <div className="flex-1 overflow-x-auto rounded-lg bg-background">
          <PurchaseLineTable mode={mode} lines={state.lines} branchId={state.branchId} onChange={(lines) => set({ lines })} />
          {!state.lines.length && (
            <div className="py-40 text-center text-[13px] text-muted-foreground">
              Tìm hàng hóa theo mã hoặc tên (phím F3) để thêm vào phiếu
            </div>
          )}
        </div>
      </div>
      <aside className="flex w-[330px] shrink-0 flex-col gap-3 self-stretch rounded-lg bg-background p-2.5">
        <PurchaseEditorPanel mode={mode} state={state} set={set} onCreateSupplier={() => setSupplierDialog(true)} />
        <div className="mt-auto grid grid-cols-2 gap-2.5 pt-2">
          <Button variant="outline" className="h-[38px] rounded-lg border-primary bg-background text-sm font-semibold text-primary hover:bg-primary/5 hover:text-primary"
            disabled={save.isPending} onClick={() => submit(false)}>
            Lưu tạm
          </Button>
          <Button className="h-[38px] rounded-lg text-sm font-semibold" disabled={save.isPending} onClick={() => submit(true)}>Hoàn thành</Button>
        </div>
      </aside>
      {supplierDialog && (
        <SupplierFormDialog onClose={() => setSupplierDialog(false)}
          onSaved={(s) => set({ supplier: { id: s.id, name: s.name } })} />
      )}
    </div>
  );
}
