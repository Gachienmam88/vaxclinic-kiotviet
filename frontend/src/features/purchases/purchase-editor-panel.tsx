"use client";

import { CircleUserRound, CreditCard, Info, User, X } from "lucide-react";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { Textarea } from "@/components/ui/textarea";
import { NumberInput } from "@/components/number-input";
import { useBranches } from "@/features/settings/settings-queries";
import { formatMoney, formatNumber } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import type { EditorMode, EditorState } from "./purchase-editor-state";
import { useUserLookup } from "./purchase-queries";
import { SupplierPicker } from "./search-pickers";
import { useSupplier } from "./supplier-queries";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

export type PanelTotals = { subtotal: number; discount: number; vat: number; total: number; quantity: number };

type Props = {
  mode: EditorMode; state: EditorState; set: (p: Partial<EditorState>) => void; sum: PanelTotals;
  onCreateSupplier: () => void; onEditSupplier: () => void;
  /** Phiếu đã nhập mở lại (chỉ Lưu): tiền trả + số HĐ đầu vào khóa. */
  completedEdit: boolean;
};

/** Ô nhập/chọn cột phải: cao 30px, viền xám, bo 6px. */
const FIELD = "h-[30px] w-full rounded-md border border-[#d1d5db] bg-background px-2 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-primary disabled:bg-[#eff0f3] disabled:opacity-100";
const NUM = "h-[30px] rounded-md disabled:bg-[#eff0f3] disabled:opacity-100";

function Row({ label, children, strong, sub }: { label: React.ReactNode; children: React.ReactNode; strong?: boolean; sub?: React.ReactNode }) {
  return (
    <div className="flex min-h-[34px] items-center justify-between gap-3 text-[13px]">
      <div className={strong ? "font-bold" : undefined}>{label}{sub && <div className="text-xs font-normal">{sub}</div>}</div>
      <div className="w-[135px] shrink-0 text-right">{children}</div>
    </div>
  );
}

/** Cột phải màn nhập hàng / trả hàng nhập (ảnh 287, 294, 300, 307). */
export function PurchaseEditorPanel({ mode, state, set, sum, onCreateSupplier, onEditSupplier, completedEdit }: Props) {
  const { data: me } = useCurrentUser();
  const { data: users = [] } = useUserLookup();
  const { data: branches = [] } = useBranches();
  const { data: supplierRow } = useSupplier(state.supplier?.id ?? "");
  const myBranches = branches.filter((b) => me?.user.branches.some((x) => x.id === b.id));
  const isReceipt = mode === "receipt";
  const t = useT(purchasesNs);
  const tc = useT(commonNs);
  const paidLocked = completedEdit || state.paymentPosted;
  const manualVat = state.vatMode === "MANUAL";
  const statusLabel = state.status === "COMPLETED" ? t(isReceipt ? "status.received" : "status.returned") : t("status.draft");
  const methodLabel = state.paymentMethod === "TRANSFER" ? t("payMethods.transfer") : t("payMethods.cash");

  return (
    <div className="space-y-1">
      <div className="mb-2 flex gap-2">
        <div className="relative w-[140px] shrink-0">
          <CircleUserRound className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <select className={cn(FIELD, "pl-7")} value={state.personId} onChange={(e) => set({ personId: e.target.value })}
            aria-label={isReceipt ? t("receipts.receiver") : t("returns.returner")}>
            {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        </div>
        <DateTimePicker aria-label={isReceipt ? t("panel.receiveTime") : t("panel.returnTime")} className={cn(FIELD, "min-w-0 flex-1")}
          value={state.at} onChange={(v) => set({ at: v })} />
      </div>
      {myBranches.length > 1 && (
        <select aria-label={tc("fields.branch")} className={cn(FIELD, "mb-2")} value={state.branchId}
          disabled={!!state.receiptId || completedEdit || state.paymentPosted} onChange={(e) => set({ branchId: e.target.value })}>
          {myBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
      {state.receiptId ? (
        <Row label={t("kv.supplier")}><span className="block truncate text-left" title={state.supplier?.name}>{state.supplier?.name ?? "—"}</span></Row>
      ) : (
        <div id="purchase-supplier-box" className="mb-1">
          {state.supplier ? (
            <div className="flex min-h-[30px] items-center gap-1.5 rounded-md border border-[#d1d5db] px-2 text-[13px]">
              <User className="size-3.5 shrink-0 text-muted-foreground" />
              <button type="button" className="min-w-0 flex-1 truncate text-left text-[#2171bc] hover:text-[#1a9dcc]" onClick={onEditSupplier}
                title={t("kv.editSupplier")}>
                {state.supplier.name}{supplierRow?.phone ? ` - ${supplierRow.phone}` : ""}
              </button>
              <button type="button" aria-label={tc("actions.clearSelection")} onClick={() => set({ supplier: null })}
                className="flex size-4 items-center justify-center rounded-full bg-muted-foreground/70 text-background hover:bg-muted-foreground"><X className="size-3" /></button>
            </div>
          ) : (
            <SupplierPicker value={null} onCreate={onCreateSupplier} onChange={(s) => set({ supplier: s ? { id: s.id, name: s.name } : null })} />
          )}
          {isReceipt && state.supplier && supplierRow && (
            <div className="pt-1.5 text-[13px]">{t("kv.debt", { amount: formatMoney(supplierRow.debt) })}</div>
          )}
        </div>
      )}
      <Row label={isReceipt ? t("panel.receiptCode") : t("kv.returnCode")}>
        <div className={cn(FIELD, "flex items-center text-left", !state.code && "text-muted-foreground", state.code && "bg-[#eff0f3]")}>
          {state.code ?? t("panel.autoCode")}</div>
      </Row>
      {state.receiptCode && <Row label={t("returns.cols.byReceipt")}><DocCodeLink code={state.receiptCode} newTab /></Row>}
      <Row label={tc("fields.status")}><span className="block text-left">{statusLabel}</span></Row>
      {isReceipt && (
        <Row label={t("filter.inputInvoiceNo")}>
          <div className="relative">
            <input aria-label={t("filter.inputInvoiceNo")} className={cn(FIELD, "pr-6")} placeholder={t("panel.inputInvoiceNoPlaceholder")}
              value={state.inputInvoiceNo} disabled={completedEdit} onChange={(e) => set({ inputInvoiceNo: e.target.value })} />
            {state.inputInvoiceNo && !completedEdit && (
              <button type="button" aria-label={tc("actions.clearSelection")} onClick={() => set({ inputInvoiceNo: "" })}
                className="absolute top-1/2 right-1.5 flex size-4 -translate-y-1/2 items-center justify-center rounded-full bg-muted-foreground/70 text-background">
                <X className="size-3" /></button>
            )}
          </div>
        </Row>
      )}
      <Row label={<span className="inline-flex items-center gap-1">{t("kv.subtotal")}
        {isReceipt ? <span className="rounded-full border px-1.5 text-[11px] leading-4">{formatNumber(sum.quantity)}</span>
          : <span title={t("kv.subtotalHint")}><Info className="size-3.5 text-muted-foreground" /></span>}</span>}>
        {formatMoney(sum.subtotal)}
      </Row>
      <Row label={t("lines.discount")}>
        <NumberInput aria-label={t("lines.discount")} className={NUM} value={state.discount} onValueChange={(discount) => set({ discount })} />
      </Row>
      <Row label={isReceipt ? t("kv.vatIn") : t("kv.vatRefund")}>
        <NumberInput aria-label={isReceipt ? t("kv.vatIn") : t("kv.vatRefund")} className={NUM} disabled={!manualVat}
          title={manualVat ? undefined : t("kv.vatAutoHint")}
          value={manualVat ? state.vatAmount : sum.vat} onValueChange={(vatAmount) => set({ vatAmount })} />
      </Row>
      {isReceipt && state.paymentPosted && !completedEdit && (
        <Row label={t("kv.paidAlready")}>
          <NumberInput aria-label={t("kv.paidAlready")} className={NUM} disabled value={state.paid} onValueChange={() => undefined} />
        </Row>
      )}
      <Row label={isReceipt ? t("panel.dueToSupplier") : t("panel.supplierDue")} strong>
        <span className="font-bold text-primary">{formatMoney(state.paymentPosted && !completedEdit ? sum.total - state.paid : sum.total)}</span>
      </Row>
      {!(isReceipt && state.paymentPosted && !completedEdit) && (
        <Row label={isReceipt ? t("kv.payToSupplier") : t("kv.supplierPays")}
          sub={<button type="button" disabled={paidLocked} className="inline-flex items-center gap-1 text-left disabled:cursor-default"
            title={t("panel.paymentMethod")} onClick={() => set({ paymentMethod: state.paymentMethod === "CASH" ? "TRANSFER" : "CASH" })}>
            {methodLabel} <CreditCard className="size-3.5 text-primary" /></button>}>
          <div id="purchase-paid-box">
            <NumberInput aria-label={isReceipt ? t("panel.payToSupplier") : t("panel.supplierPays")} className={NUM}
              value={state.paid} disabled={paidLocked} onValueChange={(paid) => set({ paid })} />
          </div>
        </Row>
      )}
      {!(isReceipt && state.paymentPosted && !completedEdit) && (
        <Row label={t("panel.toDebt")}>{formatMoney(state.paid - sum.total)}</Row>
      )}
      <Textarea aria-label={tc("fields.note")} className="mt-2 min-h-[54px] rounded-md" placeholder={tc("fields.note")} value={state.note}
        onChange={(e) => set({ note: e.target.value })} />
    </div>
  );
}
