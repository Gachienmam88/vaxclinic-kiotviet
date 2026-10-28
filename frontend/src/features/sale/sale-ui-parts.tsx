"use client";

import { Pencil } from "lucide-react";
import { PAYMENT_METHODS } from "@/features/sales/sales-types";
import type { DraftInvoice } from "./sale-types";

/** Ô nhập số kiểu gạch chân (giảm giá, khách thanh toán, SL, đơn giá) — 13px, viền dưới xám, focus viền xanh. */
export const underlineInput =
  "h-7 rounded-none border-0 border-b border-[#c8ccd2] bg-transparent px-0 text-[13px] shadow-none focus-visible:border-primary focus-visible:ring-0 dark:bg-transparent";

/** Dòng tổng tiền ở cột thanh toán: nhãn (+ số lượng phụ) bên trái, giá trị bên phải. */
export function SummaryRow({ label, sub, bold, children }: {
  label: React.ReactNode; sub?: React.ReactNode; bold?: boolean; children: React.ReactNode;
}) {
  return (
    <div className={`flex min-h-8 items-center justify-between gap-3 ${bold ? "font-bold" : ""}`}>
      <span className="flex items-center gap-2">{label}{sub != null && <span className="ml-8 font-normal">{sub}</span>}</span>
      <span className="text-right text-[15px]">{children}</span>
    </div>
  );
}

/** Ngày + giờ ở góc phải cột thanh toán (dd/MM/yyyy  HH:mm). */
export function SaleDateTime() {
  const now = new Date();
  return (
    <span className="flex shrink-0 gap-4 text-[13px]">
      <span>{now.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
      <span>{now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
    </span>
  );
}

/** Chọn phương thức thanh toán dạng radio, nhãn ngắn như KiotViet để vừa 1 dòng: Tiền mặt / Chuyển khoản / Thẻ / Ví. */
export function PaymentMethodRadios({ value, onChange }: {
  value: DraftInvoice["paymentMethod"]; onChange: (v: DraftInvoice["paymentMethod"]) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Phương thức thanh toán" className="flex flex-nowrap gap-x-4 py-1">
      {PAYMENT_METHODS.map((m) => (
        <label key={m.value} className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap">
          <input type="radio" name="sale-payment-method" className="size-4 accent-primary" checked={value === m.value}
            onChange={() => onChange(m.value)} />
          {m.value === "EWALLET" ? "Ví" : m.label}
        </label>
      ))}
    </div>
  );
}

/** Thanh "Ghi chú đơn hàng" trắng bo góc ở đáy cột trái (cả bán hàng và trả hàng). */
export function SaleOrderNote({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex h-[46px] items-center gap-2.5 rounded-lg bg-background px-5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
      <Pencil className="size-4 shrink-0 text-[#6b7280]" />
      <input className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#6b7280]"
        placeholder="Ghi chú đơn hàng" aria-label="Ghi chú đơn hàng" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
