"use client";

import { CircleUserRound } from "lucide-react";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { Textarea } from "@/components/ui/textarea";
import { NumberInput } from "@/components/number-input";
import { useBranches } from "@/features/settings/settings-queries";
import { formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import type { EditorMode, EditorState } from "./purchase-editor-state";
import { purchaseTotals } from "./purchase-math";
import { useUserLookup } from "./purchase-queries";
import { SupplierPicker } from "./search-pickers";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { purchasesNs } from "@/messages/purchases";

type Props = { mode: EditorMode; state: EditorState; set: (p: Partial<EditorState>) => void; onCreateSupplier: () => void };

const VAT_OPTIONS = [null, 0, 5, 8, 10];
/** Ô nhập/chọn cột phải: cao 30px, viền xám, bo 6px. */
const FIELD = "h-[30px] w-full rounded-md border border-[#d1d5db] bg-background px-2 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:border-primary disabled:opacity-60";

function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex min-h-[34px] items-center justify-between gap-3 text-[13px]">
      <span className={strong ? "font-bold" : undefined}>{label}</span>
      <div className="w-[150px] text-right">{children}</div>
    </div>
  );
}

/** Cột phải màn soạn phiếu: người nhập + thời gian, NCC, mã phiếu, số HĐ, tiền, ghi chú. */
export function PurchaseEditorPanel({ mode, state, set, onCreateSupplier }: Props) {
  const { data: me } = useCurrentUser();
  const { data: users = [] } = useUserLookup();
  const { data: branches = [] } = useBranches();
  const myBranches = branches.filter((b) => me?.user.branches.some((x) => x.id === b.id));
  const sum = purchaseTotals(state.lines, state.discount, state.vatRate);
  const isReceipt = mode === "receipt";
  const t = useT(purchasesNs);
  const tc = useT(commonNs);

  return (
    <div className="space-y-1.5">
      <div className="mb-2.5 flex gap-2">
        <div className="relative w-[145px] shrink-0">
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
        <select aria-label={tc("fields.branch")} className={cn(FIELD, "mb-2.5")} value={state.branchId} disabled={!!state.receiptId}
          onChange={(e) => set({ branchId: e.target.value })}>
          {myBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
      <div className="mb-2.5">
        <SupplierPicker value={state.supplier} disabled={!!state.receiptId} onCreate={onCreateSupplier}
          onChange={(s) => set({ supplier: s ? { id: s.id, name: s.name } : null })} />
      </div>
      <Row label={isReceipt ? t("panel.receiptCode") : t("returns.cols.code")}>
        <div className={cn(FIELD, "flex items-center text-left", !state.code && "text-muted-foreground")}>{state.code ?? t("panel.autoCode")}</div>
      </Row>
      {state.receiptCode && <Row label={t("returns.cols.byReceipt")}><DocCodeLink code={state.receiptCode} newTab /></Row>}
      <Row label={tc("fields.status")}><span className="block text-left">{t("status.draft")}</span></Row>
      {isReceipt && (
        <Row label={t("filter.inputInvoiceNo")}>
          <input aria-label={t("filter.inputInvoiceNo")} className={FIELD} placeholder={t("panel.inputInvoiceNoPlaceholder")} value={state.inputInvoiceNo}
            onChange={(e) => set({ inputInvoiceNo: e.target.value })} />
        </Row>
      )}
      <Row label={t("summary.subtotalQty", { qty: sum.quantity })}>{formatMoney(sum.subtotal)}</Row>
      <Row label={t("lines.discount")}><NumberInput aria-label={t("lines.discount")} className="h-[30px] rounded-md" value={state.discount} onValueChange={(discount) => set({ discount })} /></Row>
      <Row label="VAT">
        <select aria-label="VAT" className={FIELD} value={state.vatRate == null ? "" : String(state.vatRate)}
          onChange={(e) => set({ vatRate: e.target.value === "" ? null : Number(e.target.value) })}>
          {VAT_OPTIONS.map((v) => <option key={String(v)} value={v == null ? "" : v}>{v == null ? t("panel.noVat") : t("summary.vatRate", { rate: v })}</option>)}
        </select>
      </Row>
      {state.vatRate != null && <Row label={t("panel.vatAmount", { rate: state.vatRate })}>{formatMoney(sum.vat)}</Row>}
      <Row label={isReceipt ? t("panel.dueToSupplier") : t("panel.supplierDue")} strong>
        <span className="font-bold text-primary">{formatMoney(sum.total)}</span>
      </Row>
      <Row label={isReceipt ? t("panel.payToSupplier") : t("panel.supplierPays")}>
        <NumberInput aria-label={isReceipt ? t("panel.payToSupplier") : t("panel.supplierPays")} className="h-[30px] rounded-md"
          value={state.paid} onValueChange={(paid) => set({ paid })} />
      </Row>
      {isReceipt && state.paid > 0 && (
        <Row label={t("panel.method")}>
          <select aria-label={t("panel.paymentMethod")} className={FIELD} value={state.paymentMethod}
            onChange={(e) => set({ paymentMethod: e.target.value as "CASH" | "TRANSFER" })}>
            <option value="CASH">{t("payMethods.cash")}</option><option value="TRANSFER">{t("payMethods.transfer")}</option>
          </select>
        </Row>
      )}
      <Row label={isReceipt ? t("panel.toDebt") : t("panel.receivableFromSupplier")}>{formatMoney(Math.max(sum.total - state.paid, 0))}</Row>
      <Textarea aria-label={tc("fields.note")} className="mt-2.5 min-h-[58px] rounded-md" placeholder={tc("fields.note")} value={state.note}
        onChange={(e) => set({ note: e.target.value })} />
    </div>
  );
}
