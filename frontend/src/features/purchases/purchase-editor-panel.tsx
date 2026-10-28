"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NumberInput } from "@/components/number-input";
import { NativeSelect } from "@/features/products/product-form-sections";
import { useBranches } from "@/features/settings/settings-queries";
import { formatMoney } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import type { EditorMode, EditorState } from "./purchase-editor-state";
import { purchaseTotals } from "./purchase-math";
import { useUserLookup } from "./purchase-queries";
import { SupplierPicker } from "./search-pickers";

type Props = { mode: EditorMode; state: EditorState; set: (p: Partial<EditorState>) => void; onCreateSupplier: () => void };

const VAT_OPTIONS = [null, 0, 5, 8, 10];

function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3 text-sm">
      <span className={strong ? "font-semibold" : undefined}>{label}</span>
      <div className="w-40 text-right">{children}</div>
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
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <NativeSelect value={state.personId} onChange={(e) => set({ personId: e.target.value })}
          aria-label={isReceipt ? "Người nhập" : "Người trả"}>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </NativeSelect>
        <Input type="datetime-local" value={state.at} onChange={(e) => set({ at: e.target.value })} />
      </div>
      {myBranches.length > 1 && (
        <NativeSelect value={state.branchId} disabled={!!state.receiptId} onChange={(e) => set({ branchId: e.target.value })}>
          {myBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </NativeSelect>
      )}
      <SupplierPicker value={state.supplier} disabled={!!state.receiptId} onCreate={onCreateSupplier}
        onChange={(s) => set({ supplier: s ? { id: s.id, name: s.name } : null })} />
      <Row label={isReceipt ? "Mã phiếu nhập" : "Mã trả hàng nhập"}>
        <span className="text-muted-foreground">{state.code ?? "Mã phiếu tự động"}</span>
      </Row>
      {state.receiptCode && <Row label="Theo phiếu nhập"><span className="text-primary">{state.receiptCode}</span></Row>}
      <Row label="Trạng thái"><span>Phiếu tạm</span></Row>
      {isReceipt && (
        <Row label="Số hóa đơn đầu vào">
          <Input className="h-8" placeholder="Nhập số hóa đơn" value={state.inputInvoiceNo}
            onChange={(e) => set({ inputInvoiceNo: e.target.value })} />
        </Row>
      )}
      <div className="border-t pt-2" />
      <Row label={`Tổng tiền hàng (${t.quantity})`}>{formatMoney(t.subtotal)}</Row>
      <Row label="Giảm giá"><NumberInput className="h-8" value={state.discount} onValueChange={(discount) => set({ discount })} /></Row>
      <Row label="VAT">
        <NativeSelect value={state.vatRate == null ? "" : String(state.vatRate)}
          onChange={(e) => set({ vatRate: e.target.value === "" ? null : Number(e.target.value) })}>
          {VAT_OPTIONS.map((v) => <option key={String(v)} value={v == null ? "" : v}>{v == null ? "Không VAT" : `VAT ${v}%`}</option>)}
        </NativeSelect>
      </Row>
      {state.vatRate != null && <Row label={`Tiền VAT ${state.vatRate}%`}>{formatMoney(t.vat)}</Row>}
      <Row label={isReceipt ? "Cần trả nhà cung cấp" : "Nhà cung cấp cần trả"} strong>
        <span className="font-semibold text-primary">{formatMoney(t.total)}</span>
      </Row>
      <Row label={isReceipt ? "Tiền trả nhà cung cấp" : "Tiền nhà cung cấp trả"}>
        <NumberInput className="h-8" value={state.paid} onValueChange={(paid) => set({ paid })} />
      </Row>
      {isReceipt && state.paid > 0 && (
        <Row label="Phương thức">
          <NativeSelect value={state.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value as "CASH" | "TRANSFER" })}>
            <option value="CASH">Tiền mặt</option><option value="TRANSFER">Chuyển khoản</option>
          </NativeSelect>
        </Row>
      )}
      <Row label={isReceipt ? "Tính vào công nợ" : "Còn phải thu NCC"}>{formatMoney(Math.max(t.total - state.paid, 0))}</Row>
      <Textarea placeholder="Ghi chú" value={state.note} onChange={(e) => set({ note: e.target.value })} />
    </div>
  );
}
