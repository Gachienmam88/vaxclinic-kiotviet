"use client";

import { api } from "@/lib/api-client";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useHrMutation } from "./hr-queries";
import type { PayrollPayment } from "./hr-types";

/** Lịch sử thanh toán lương: mỗi phiếu PCPL… tương ứng 1 phiếu chi trong Sổ quỹ (phần tiền mặt / CK). */
export function PayrollPaymentHistory({ payments }: { payments: PayrollPayment[] }) {
  const cancel = useHrMutation((id: string) => api(`/hr/payrolls/payments/${id}/cancel`, { method: "POST" }), "Đã hủy phiếu thanh toán");
  return (
    <section className="rounded-lg bg-white">
      <h2 className="border-b border-[#eceef1] px-4 py-3 text-[15px] font-semibold">Lịch sử thanh toán</h2>
      <table className="w-full text-[13px]">
        <thead><tr className="bg-[#eff0f3] text-left [&_th]:h-[30px] [&_th]:px-3 [&_th]:font-semibold">
          <th>Mã phiếu</th><th>Nhân viên</th><th className="text-right">Tiền mặt / CK</th><th className="text-right">Trừ tạm ứng</th>
          <th>Phương thức</th><th>Thời gian</th><th>Người tạo</th><th>Trạng thái</th><th />
        </tr></thead>
        <tbody>
          {!payments.length && <tr><td colSpan={9} className="py-6 text-center text-muted-foreground">Chưa có phiếu thanh toán</td></tr>}
          {payments.map((p) => (
            <tr key={p.id} className={cn("border-b border-[#eceef1] [&_td]:px-3 [&_td]:py-2", p.cancelled && "text-muted-foreground line-through")}>
              <td>{p.code}</td><td>{p.employeeName}</td>
              <td className="text-right">{formatMoney(p.cashAmount)}</td><td className="text-right">{formatMoney(p.advanceAmount)}</td>
              <td>{p.method === "BANK" ? "Chuyển khoản" : "Tiền mặt"}</td><td>{formatDateTime(p.paidAt)}</td><td>{p.createdByName}</td>
              <td className="no-underline">{p.cancelled ? "Đã hủy" : "Đã thanh toán"}</td>
              <td className="text-right">
                {!p.cancelled && (
                  <button type="button" className="text-destructive hover:underline" disabled={cancel.isPending}
                    onClick={() => confirm(`Hủy phiếu thanh toán ${p.code}? Phiếu chi trong Sổ quỹ cũng bị hủy.`) && cancel.mutate(p.id)}>
                    Hủy phiếu
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
