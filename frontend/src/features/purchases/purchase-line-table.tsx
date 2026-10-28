"use client";

import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/number-input";
import { NativeSelect } from "@/features/products/product-form-sections";
import { useProductLots } from "@/features/products/product-queries";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { lineAmount } from "./purchase-math";
import { changeUnit, type LineForm } from "./purchase-line-form";

type Props = {
  mode: "receipt" | "return";
  lines: LineForm[];
  branchId: string;
  onChange: (lines: LineForm[]) => void;
  readOnly?: boolean;
};

/** Phiếu trả: chọn lô đang tồn tại điểm tiêm (FEFO, hiển thị tồn từng lô). */
function LotSelect({ line, branchId, onChange, disabled }: {
  line: LineForm; branchId: string; onChange: (lot: string) => void; disabled?: boolean;
}) {
  const { data: lots = [] } = useProductLots(line.productId, true);
  const here = lots.filter((l) => l.branchId === branchId);
  return (
    <NativeSelect value={line.lotNumber} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">Chọn lô</option>
      {here.map((l) => (
        <option key={l.id} value={l.lotNumber}>{l.lotNumber} — HSD {formatDate(l.expiryDate)} — tồn {formatNumber(l.quantity)}</option>
      ))}
    </NativeSelect>
  );
}

export function PurchaseLineTable({ mode, lines, branchId, onChange, readOnly }: Props) {
  const update = (key: string, patch: Partial<LineForm>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const isReceipt = mode === "receipt";

  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-primary/10 text-left">
        <tr>
          <th className="w-10 px-2 py-2" /><th className="w-12 px-2">STT</th><th className="px-2">Mã hàng</th>
          <th className="px-2">Tên hàng</th><th className="w-28 px-2">ĐVT</th>
          <th className="w-28 px-2 text-right">Số lượng</th><th className="w-36 px-2 text-right">{isReceipt ? "Đơn giá" : "Giá trả"}</th>
          {isReceipt && <th className="w-32 px-2 text-right">Giảm giá</th>}
          <th className="w-36 px-2 text-right">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => {
          const unit = l.units.find((u) => u.id === l.unitId) ?? l.units[0];
          return (
            <tr key={l.key} className="border-b align-top">
              <td className="px-2 py-2">
                {!readOnly && (
                  <button type="button" aria-label="Xóa dòng" className="text-muted-foreground hover:text-destructive"
                    onClick={() => onChange(lines.filter((x) => x.key !== l.key))}><Trash2 className="size-4" /></button>
                )}
              </td>
              <td className="px-2 py-2">{i + 1}</td>
              <td className="px-2 py-2 text-primary">{unit.code}</td>
              <td className="px-2 py-2">
                {l.productName}
                {l.lotManaged && (
                  <div className="mt-1.5 grid max-w-md grid-cols-2 gap-1.5">
                    {isReceipt ? (
                      <>
                        <Input placeholder="Số lô" value={l.lotNumber} disabled={readOnly}
                          onChange={(e) => update(l.key, { lotNumber: e.target.value })} />
                        <Input type="date" title="Hạn sử dụng" value={l.expiryDate} disabled={readOnly}
                          onChange={(e) => update(l.key, { expiryDate: e.target.value })} />
                      </>
                    ) : (
                      <div className="col-span-2">
                        <LotSelect line={l} branchId={branchId} disabled={readOnly}
                          onChange={(lotNumber) => update(l.key, { lotNumber })} />
                      </div>
                    )}
                  </div>
                )}
              </td>
              <td className="px-2 py-2">
                <NativeSelect value={l.unitId} disabled={readOnly || l.units.length < 2}
                  onChange={(e) => onChange(lines.map((x) => (x.key === l.key ? changeUnit(x, e.target.value) : x)))}>
                  {l.units.map((u) => <option key={u.id} value={u.id}>{u.unitName}</option>)}
                </NativeSelect>
              </td>
              <td className="px-2 py-2">
                <NumberInput value={l.quantity} disabled={readOnly} onValueChange={(quantity) => update(l.key, { quantity })} />
              </td>
              <td className="px-2 py-2">
                <NumberInput value={l.unitPrice} disabled={readOnly} onValueChange={(unitPrice) => update(l.key, { unitPrice })} />
              </td>
              {isReceipt && (
                <td className="px-2 py-2">
                  <NumberInput value={l.discount} disabled={readOnly} onValueChange={(discount) => update(l.key, { discount })} />
                </td>
              )}
              <td className="px-2 py-2 text-right font-semibold">{formatMoney(lineAmount(l))}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
