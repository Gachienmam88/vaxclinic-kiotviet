"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import { formatMoney, parseNumber } from "@/lib/format";
import { useHrMutation } from "./hr-queries";
import type { PayrollDetail } from "./hr-types";
import { DocCodeLink } from "@/components/ui/doc-code-link";

type Row = { cash: string; advance: string };
const box = "h-7 w-28 rounded border border-[#d9dbe0] px-1.5 text-right outline-none focus:border-primary";

/**
 * Thanh toán bảng lương đã chốt: mỗi nhân viên trả bằng tiền mặt / chuyển khoản (ghi phiếu chi "Chi trả lương nhân viên"
 * vào Sổ quỹ) và/hoặc trừ vào tạm ứng (tối đa số dư Nợ và tạm ứng).
 */
export function PayrollPayDialog({ detail, onClose }: { detail: PayrollDetail; onClose: () => void }) {
  const slips = detail.payslips.filter((s) => s.total - s.paid > 0);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [method, setMethod] = useState<"CASH" | "BANK">("CASH");
  const get = (id: string) => rows[id] ?? { cash: "", advance: "" };
  const set = (id: string, patch: Partial<Row>) => setRows({ ...rows, [id]: { ...get(id), ...patch } });
  const payAll = () => setRows(Object.fromEntries(slips.map((s) => {
    const remaining = s.total - s.paid;
    const adv = Math.max(0, Math.min(remaining, s.advanceBalance));
    return [s.id, { cash: formatMoney(remaining - adv), advance: formatMoney(adv) }];
  })));
  const items = slips.map((s) => ({ payslipId: s.id, cashAmount: parseNumber(get(s.id).cash), advanceAmount: parseNumber(get(s.id).advance) }))
    .filter((i) => i.cashAmount + i.advanceAmount > 0);
  const invalid = slips.some((s) => {
    const r = get(s.id);
    const c = parseNumber(r.cash), a = parseNumber(r.advance);
    return c + a > s.total - s.paid || a > Math.max(0, s.advanceBalance);
  });
  const total = items.reduce((t, i) => t + i.cashAmount + i.advanceAmount, 0);
  const pay = useHrMutation(() => api<PayrollDetail>(`/hr/payrolls/${detail.payroll.id}/payments`, {
    method: "POST", body: { items, method },
  }), "Đã thanh toán lương", onClose);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Thanh toán {detail.payroll.code} - {detail.payroll.name}</DialogTitle></DialogHeader>
        <div className="flex items-center gap-3 text-[13px]">
          <label htmlFor="pay-method">Hình thức</label>
          <select id="pay-method" className="h-7 rounded border border-[#d9dbe0] px-2" value={method}
            onChange={(e) => setMethod(e.target.value as "CASH" | "BANK")}>
            <option value="CASH">Tiền mặt</option><option value="BANK">Chuyển khoản</option>
          </select>
          <button type="button" className="ml-auto text-primary hover:underline" onClick={payAll}>Trả hết cho tất cả</button>
        </div>
        <table className="w-full text-[13px]">
          <thead><tr className="bg-[#eff0f3] text-left [&_th]:h-[30px] [&_th]:px-2">
            <th>Nhân viên</th><th className="text-right">Còn cần trả</th><th className="text-right">Tạm ứng còn</th>
            <th className="text-right">Tiền mặt / CK</th><th className="text-right">Trừ tạm ứng</th>
          </tr></thead>
          <tbody>
            {!slips.length && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Đã trả đủ lương cho tất cả nhân viên</td></tr>}
            {slips.map((s) => {
              const r = get(s.id);
              const maxAdv = Math.max(0, Math.min(s.total - s.paid, s.advanceBalance));
              return (
                <tr key={s.id} className="border-b border-[#eceef1] [&_td]:px-2 [&_td]:py-1.5">
                  <td><DocCodeLink code={s.employeeCode} /> - {s.employeeName}</td>
                  <td className="text-right">{formatMoney(s.total - s.paid)}</td>
                  <td className="text-right">{formatMoney(s.advanceBalance)}</td>
                  <td className="text-right"><input aria-label={`Tiền trả ${s.employeeName}`} className={box} value={r.cash}
                    onChange={(e) => set(s.id, { cash: e.target.value.replace(/[^\d,]/g, "") })} /></td>
                  <td className="text-right"><input aria-label={`Trừ tạm ứng ${s.employeeName}`} className={box} value={r.advance}
                    disabled={maxAdv <= 0} placeholder={maxAdv > 0 ? `≤ ${formatMoney(maxAdv)}` : ""}
                    onChange={(e) => set(s.id, { advance: e.target.value.replace(/[^\d,]/g, "") })} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {invalid && <p className="text-[13px] text-destructive">Số tiền vượt quá số còn cần trả hoặc số dư tạm ứng.</p>}
        <DialogFooter>
          <span className="mr-auto self-center text-[13px]">Tổng thanh toán: <b>{formatMoney(total)}</b></span>
          <Button variant="outline" onClick={onClose}>Bỏ qua</Button>
          <Button disabled={!items.length || invalid || pay.isPending} onClick={() => pay.mutate(undefined)}>Thanh toán</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
