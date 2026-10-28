"use client";

import { Pencil } from "lucide-react";
import { useT } from "@/lib/i18n";
import { saleNs } from "@/messages/sale";
import { enumLabel } from "@/features/sales/i18n-enum-label";
import { salesNs } from "@/messages/sales";
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

type Method = DraftInvoice["paymentMethod"];

/** Phương thức thanh toán của màn bán hàng (thứ tự hiển thị) + khóa nhãn đầy đủ / nhãn ngắn (radio 1 dòng). */
export const SALE_PAYMENT_METHODS: readonly Method[] = ["CASH", "TRANSFER", "CARD", "EWALLET"];

/** Tên phương thức thanh toán theo ngôn ngữ giao diện (khóa dùng chung sales "enums.paymentMethod.<m>"). */
export function usePaymentMethodLabel() {
  const ts = useT(salesNs);
  return (m: Method) => enumLabel(ts, salesNs, "enums.paymentMethod", m);
}

/** Chọn phương thức thanh toán dạng radio, nhãn ngắn như KiotViet để vừa 1 dòng: Tiền mặt / Chuyển khoản / Thẻ / Ví. */
export function PaymentMethodRadios({ value, onChange }: { value: Method; onChange: (v: Method) => void }) {
  const t = useT(saleNs);
  const label = usePaymentMethodLabel();
  return (
    <div role="radiogroup" aria-label={t("payment.method")} className="flex flex-nowrap gap-x-4 py-1">
      {SALE_PAYMENT_METHODS.map((m) => (
        <label key={m} className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap">
          <input type="radio" name="sale-payment-method" className="size-4 accent-primary" checked={value === m}
            onChange={() => onChange(m)} />
          {m === "EWALLET" ? t("payment.methods.ewalletShort") : label(m)}
        </label>
      ))}
    </div>
  );
}

/** Thanh "Ghi chú đơn hàng" trắng bo góc ở đáy cột trái (cả bán hàng và trả hàng). */
export function SaleOrderNote({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT(saleNs);
  return (
    <label className="flex h-[46px] items-center gap-2.5 rounded-lg bg-background px-5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
      <Pencil className="size-4 shrink-0 text-[#6b7280]" />
      <input className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#6b7280]"
        placeholder={t("checkout.orderNote")} aria-label={t("checkout.orderNote")} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
