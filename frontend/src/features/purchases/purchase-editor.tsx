"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePrinter } from "@/features/print/print-button";
import { purchaseReturnData, receiptData } from "@/features/print/print-data";
import { api, errorMessage } from "@/lib/api-client";
import { usePurchaseEditorShortcuts } from "./purchase-editor-shortcuts";
import { useEditorOptions, usePrintSettings } from "./purchase-editor-options";
import { PurchaseEditorToolbar } from "./purchase-editor-toolbar";
import { useUserLookup } from "./purchase-queries";
import { toRequest, type EditorMode, type EditorState } from "./purchase-editor-state";
import { PurchaseEditorPanel } from "./purchase-editor-panel";
import { lineFromProduct } from "./purchase-line-form";
import { PurchaseLineTable } from "./purchase-line-table";
import { purchaseTotals } from "./purchase-math";
import { PayNowDialog } from "./pay-now-dialog";
import type { PurchaseReturn, Receipt } from "./purchase-types";
import { ProductPicker } from "./search-pickers";
import { SupplierFormDialog } from "./supplier-form-dialog";
import { useSupplier } from "./supplier-queries";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

const CONFIG = {
  receipt: { title: "receipts.title", endpoint: "/purchase-receipts", listPath: "/purchases/receipts", listKey: "purchase-receipts" },
  return: { title: "returns.title", endpoint: "/purchase-returns", listPath: "/purchases/returns", listKey: "purchase-returns" },
} as const;

type SaveArgs = { complete: boolean; payNow?: boolean };

/**
 * Màn soạn phiếu nhập / trả hàng nhập (trang toàn màn hình như KiotViet, ảnh 287–291, 294, 300, 307).
 * - Phiếu mới / phiếu tạm: Lưu tạm + Hoàn thành; Lưu tạm có tiền trả NCC → hỏi có lưu phiếu chi ngay không.
 * - Phiếu đã nhập ("Mở phiếu"): chỉ nút Lưu → PUT /adjust (không thêm / bớt dòng, tiền trả khóa).
 * - Lập từ hóa đơn đầu vào (state.inputInvoiceId): lưu xong gắn "Đã lập phiếu" cho hóa đơn.
 */
export function PurchaseEditor({ mode, initial }: { mode: EditorMode; initial: EditorState }) {
  const cfg = CONFIG[mode];
  const router = useRouter();
  const qc = useQueryClient();
  const print = usePrinter();
  const { data: users = [] } = useUserLookup();
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  const [state, setState] = useState(initial);
  const [opts, setOpts] = useEditorOptions();
  const [printCfg, setPrintCfg] = usePrintSettings();
  const [supplierDialog, setSupplierDialog] = useState<"create" | "edit" | null>(null);
  const [askPayNow, setAskPayNow] = useState(false);
  const { data: supplierRow } = useSupplier(supplierDialog === "edit" ? state.supplier?.id ?? "" : "");
  const autoPaid = useRef(!initial.id && !initial.paid);
  const set = (p: Partial<EditorState>) => setState((s) => ({ ...s, ...p }));
  const isReceipt = mode === "receipt";
  const completedEdit = isReceipt && state.status === "COMPLETED";
  const sum = purchaseTotals(state.lines, state.discount, undefined, state.vatMode, state.vatAmount);
  const lockedPaid = completedEdit || state.paymentPosted;

  // "Mặc định trả nhà cung cấp": tiền trả = cần trả cho tới khi người dùng tự sửa ô tiền trả
  useEffect(() => {
    if (opts.defaultPayAll && autoPaid.current && !lockedPaid && state.paid !== sum.total) set({ paid: sum.total });
  }, [opts.defaultPayAll, sum.total, lockedPaid]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: ({ complete, payNow }: SaveArgs) => {
      const personName = users.find((u) => u.id === state.personId)?.fullName ?? "";
      const body = toRequest(mode, state, personName, payNow);
      if (completedEdit) return api<Receipt>(`${cfg.endpoint}/${state.id}/adjust`, { method: "PUT", body });
      const url = state.id ? `${cfg.endpoint}/${state.id}` : cfg.endpoint;
      return api<Receipt | PurchaseReturn>(`${url}?complete=${complete}`, { method: state.id ? "PUT" : "POST", body });
    },
    onSuccess: async (doc, { complete }) => {
      toast.success(completedEdit ? t("kv.toastAdjusted", { code: doc.code })
        : t(complete ? "editor.toastCompleted" : "editor.toastDrafted", { code: doc.code }));
      if (isReceipt && state.inputInvoiceId) {
        await api(`/input-invoices/${state.inputInvoiceId}/link`, { method: "PATCH", body: { type: "RECEIPT", id: doc.id, code: doc.code } })
          .catch((e) => toast.error(t("editor.linkInvoiceFailed", { error: errorMessage(e) })));
        try { sessionStorage.removeItem(`input-invoice-receipt:${state.inputInvoiceId}`); } catch { /* bỏ qua */ }
        qc.invalidateQueries({ queryKey: ["input-invoices"] });
      }
      if (complete && printCfg.auto) {
        if (isReceipt) print("PURCHASE_RECEIPT", receiptData(doc as Receipt), doc.branchId, printCfg.copies);
        else print("PURCHASE_RETURN", purchaseReturnData(doc as PurchaseReturn), doc.branchId, printCfg.copies);
      }
      qc.invalidateQueries({ queryKey: [cfg.listKey] });
      qc.invalidateQueries({ queryKey: ["purchase-receipt"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["supplier"] });
      router.push(`${cfg.listPath}?code=${encodeURIComponent(doc.code)}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function submit(complete: boolean) {
    if (save.isPending) return;
    const active = isReceipt ? state.lines : state.lines.filter((l) => l.quantity > 0);
    if (!active.length) return toast.error(t(isReceipt ? "editor.noLines" : "kv.noReturnQty"));
    if (complete || completedEdit) {
      const missing = active.find((l) => l.lotManaged && (!l.lotNumber || (isReceipt && !l.expiryDate)));
      if (missing) return toast.error(t(isReceipt ? "editor.missingLotExpiry" : "editor.missingReturnLot", { product: missing.productName }));
    }
    if (isReceipt && !complete && !completedEdit && !state.paymentPosted && state.paid > 0) return setAskPayNow(true);
    save.mutate({ complete });
  }

  usePurchaseEditorShortcuts(() => submit(!completedEdit), (i, delta) => {
    const l = state.lines[i];
    if (!l) return;
    const q = Math.max(0, l.quantity + delta);
    set({ lines: state.lines.map((x, n) => (n === i ? { ...x, quantity: l.maxQty != null ? Math.min(q, l.maxQty) : q } : x)) });
  });

  const canAddLines = !completedEdit && !state.receiptId;
  return (
    <div className="flex min-h-[calc(100vh-110px)] gap-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex h-8 items-center gap-2.5">
          <Button variant="ghost" size="icon-sm" onClick={() => router.push(cfg.listPath)} aria-label={tc("actions.back")}><ArrowLeft /></Button>
          <h1 className="text-lg font-bold">{t(cfg.title)}</h1>
          {canAddLines && (
            <ProductPicker onPick={(p) => set({ lines: [...state.lines, { ...lineFromProduct(p), vatRate: state.vatRate }] })} />
          )}
          <PurchaseEditorToolbar vatOn={state.vatMode === "LINE"} isReceipt={isReceipt} opts={opts} setOpts={setOpts} print={printCfg}
            setPrint={setPrintCfg} onVat={(on) => set(on ? { vatMode: "LINE" } : { vatMode: "MANUAL", vatAmount: sum.vat })} />
        </div>
        <div className="flex-1 overflow-x-auto rounded-lg bg-background">
          <PurchaseLineTable mode={mode} lines={state.lines} branchId={state.branchId} onChange={(lines) => set({ lines })}
            lockStructure={completedEdit} vatOn={state.vatMode === "LINE"} opts={opts} />
          {!state.lines.length && <div className="py-40 text-center text-[13px] text-muted-foreground">{t("editor.emptyHint")}</div>}
        </div>
      </div>
      <aside className="flex w-[330px] shrink-0 flex-col gap-3 self-stretch rounded-lg bg-background p-2.5">
        <PurchaseEditorPanel mode={mode} state={state} sum={sum} completedEdit={completedEdit}
          set={(p) => { if ("paid" in p) autoPaid.current = false; set(p); }}
          onCreateSupplier={() => setSupplierDialog("create")} onEditSupplier={() => setSupplierDialog("edit")} />
        <div className="mt-auto pt-2">
          {completedEdit ? (
            <Button className="h-[38px] w-full rounded-lg text-sm font-semibold" disabled={save.isPending} onClick={() => submit(false)}>{tc("actions.save")}</Button>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="outline" className="h-[38px] rounded-lg border-primary bg-background text-sm font-semibold text-primary hover:bg-primary/5 hover:text-primary"
                disabled={save.isPending} onClick={() => submit(false)}>{t("editor.saveDraft")}</Button>
              <Button className="h-[38px] rounded-lg text-sm font-semibold" disabled={save.isPending} onClick={() => submit(true)}>{t("editor.complete")}</Button>
            </div>
          )}
        </div>
      </aside>
      {supplierDialog === "create" && (
        <SupplierFormDialog onClose={() => setSupplierDialog(null)} onSaved={(s) => set({ supplier: { id: s.id, name: s.name } })} />
      )}
      {supplierDialog === "edit" && supplierRow && (
        <SupplierFormDialog supplier={supplierRow} debt={supplierRow} onClose={() => setSupplierDialog(null)}
          onSaved={(s) => set({ supplier: { id: s.id, name: s.name } })} />
      )}
      {askPayNow && (
        <PayNowDialog amount={state.paid} onClose={() => setAskPayNow(false)}
          onAnswer={(payNow) => { setAskPayNow(false); save.mutate({ complete: false, payNow }); }} />
      )}
    </div>
  );
}
