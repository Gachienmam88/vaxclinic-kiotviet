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
  const t = purchaseTotals(state.lines, state.discount, state.vatRate);
  const isReceipt = mode === "receipt";

  return (
    <div className="space-y-1.5">
      <div className="mb-2.5 flex gap-2">
        <div className="relative w-[145px] shrink-0">
          <CircleUserRound className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <select className={cn(FIELD, "pl-7")} value={state.personId} onChange={(e) => set({ personId: e.target.value })}
            aria-label={isReceipt ? "Người nhập" : "Người trả"}>
            {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        </div>
        <DateTimePicker aria-label={isReceipt ? "Thời gian nhập" : "Thời gian trả"} className={cn(FIELD, "min-w-0 flex-1")}
          value={state.at} onChange={(v) => set({ at: v })} />
      </div>
      {myBranches.length > 1 && (
        <select aria-label="Chi nhánh" className={cn(FIELD, "mb-2.5")} value={state.branchId} disabled={!!state.receiptId}
          onChange={(e) => set({ branchId: e.target.value })}>
          {myBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}
      <div className="mb-2.5">
        <SupplierPicker value={state.supplier} disabled={!!state.receiptId} onCreate={onCreateSupplier}
          onChange={(s) => set({ supplier: s ? { id: s.id, name: s.name } : null })} />
      </div>
      <Row label={isReceipt ? "Mã phiếu nhập" : "Mã trả hàng nhập"}>
        <div className={cn(FIELD, "flex items-center text-left", !state.code && "text-muted-foreground")}>{state.code ?? "Mã phiếu tự động"}</div>
      </Row>
      {state.receiptCode && <Row label="Theo phiếu nhập"><DocCodeLink code={state.receiptCode} newTab /></Row>}
      <Row label="Trạng thái"><span className="block text-left">Phiếu tạm</span></Row>
      {isReceipt && (
        <Row label="Số hóa đơn đầu vào">
          <input aria-label="Số hóa đơn đầu vào" className={FIELD} placeholder="Nhập số hóa đơn đầu vào" value={state.inputInvoiceNo}
            onChange={(e) => set({ inputInvoiceNo: e.target.value })} />
        </Row>
      )}
      <Row label={`Tổng tiền hàng (${t.quantity})`}>{formatMoney(t.subtotal)}</Row>
      <Row label="Giảm giá"><NumberInput aria-label="Giảm giá" className="h-[30px] rounded-md" value={state.discount} onValueChange={(discount) => set({ discount })} /></Row>
      <Row label="VAT">
        <select aria-label="VAT" className={FIELD} value={state.vatRate == null ? "" : String(state.vatRate)}
          onChange={(e) => set({ vatRate: e.target.value === "" ? null : Number(e.target.value) })}>
          {VAT_OPTIONS.map((v) => <option key={String(v)} value={v == null ? "" : v}>{v == null ? "Không VAT" : `VAT ${v}%`}</option>)}
        </select>
      </Row>
      {state.vatRate != null && <Row label={`Tiền VAT ${state.vatRate}%`}>{formatMoney(t.vat)}</Row>}
      <Row label={isReceipt ? "Cần trả nhà cung cấp" : "Nhà cung cấp cần trả"} strong>
        <span className="font-bold text-primary">{formatMoney(t.total)}</span>
      </Row>
      <Row label={isReceipt ? "Tiền trả nhà cung cấp" : "Tiền nhà cung cấp trả"}>
        <NumberInput aria-label={isReceipt ? "Tiền trả nhà cung cấp" : "Tiền nhà cung cấp trả"} className="h-[30px] rounded-md"
          value={state.paid} onValueChange={(paid) => set({ paid })} />
      </Row>
      {isReceipt && state.paid > 0 && (
        <Row label="Phương thức">
          <select aria-label="Phương thức thanh toán" className={FIELD} value={state.paymentMethod}
            onChange={(e) => set({ paymentMethod: e.target.value as "CASH" | "TRANSFER" })}>
            <option value="CASH">Tiền mặt</option><option value="TRANSFER">Chuyển khoản</option>
          </select>
        </Row>
      )}
      <Row label={isReceipt ? "Tính vào công nợ" : "Còn phải thu NCC"}>{formatMoney(Math.max(t.total - state.paid, 0))}</Row>
      <Textarea aria-label="Ghi chú" className="mt-2.5 min-h-[58px] rounded-md" placeholder="Ghi chú" value={state.note}
        onChange={(e) => set({ note: e.target.value })} />
    </div>
  );
}
