"use client";

import { Inbox } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { useT } from "@/lib/i18n";
import { saleNs } from "@/messages/sale";

/** Đầu bảng xanh của các hộp thoại màn bán hàng (Xử lý đặt hàng, Chọn hóa đơn trả hàng, Đồng bộ phiếu). */
export const SALE_TABLE_HEAD = "bg-primary-soft text-left text-[13px] font-bold text-white [&_th]:h-9 [&_th]:px-2.5 [&_th]:font-bold";

/** Dòng trống: icon hộp + "Không tìm thấy kết quả nào phù hợp". */
export function SaleTableEmpty({ colSpan, text }: { colSpan: number; text?: string }) {
  const t = useT(saleNs);
  return (
    <tr><td colSpan={colSpan} className="py-8 text-center text-[13px] text-[#4b5563]">
      <Inbox className="mx-auto mb-2 size-7 stroke-[1.5] text-[#6b7280]" />{text ?? t("dialogs.noResults")}
    </td></tr>
  );
}

/** Thẻ lọc bên trái (bóng nhẹ, tiêu đề đậm). */
export function SaleFilterCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-background px-3.5 pt-2.5 pb-3 shadow-[0_1px_6px_rgba(0,0,0,0.12)]">
      <p className="mb-1 text-[13px] font-bold">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

/** Ô tìm gạch chân (Theo mã hóa đơn, Theo khách hàng...). */
export function SaleFilterInput({ placeholder, value, onChange, autoFocus }: {
  placeholder: string; value: string; onChange: (v: string) => void; autoFocus?: boolean;
}) {
  return (
    <input aria-label={placeholder} placeholder={placeholder} value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)}
      className="h-[33px] w-full border-b border-[#c8ccd2] bg-transparent text-[13px] outline-none placeholder:text-[#6b7280] focus:border-primary" />
  );
}

/** Thẻ "Thời gian": Từ ngày (mặc định 30 ngày trước) + Đến ngày. */
export function SaleDateRangeCard({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const t = useT(saleNs);
  const cls = "h-[33px] w-full border-0 border-b border-[#c8ccd2] rounded-none px-0 text-[13px] shadow-none";
  return (
    <SaleFilterCard title={t("dialogs.time")}>
      <DatePicker aria-label={t("dialogs.fromDate")} className={cls} value={from} onChange={(v) => onChange(v, to)} />
      <DatePicker aria-label={t("dialogs.toDate")} placeholder={t("dialogs.toDate")} className={cls} value={to} onChange={(v) => onChange(from, v)} />
    </SaleFilterCard>
  );
}

/** yyyy-MM-dd của n ngày trước (giờ máy). */
export function ymdDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Khoảng ngày (giờ máy) → tham số from/to ISO cho API (to = hết ngày "Đến ngày"). */
export function rangeParams(from: string, to: string) {
  const p = new URLSearchParams();
  if (from) p.set("from", new Date(`${from}T00:00:00`).toISOString());
  if (to) { const end = new Date(`${to}T00:00:00`); end.setDate(end.getDate() + 1); p.set("to", end.toISOString()); }
  return p;
}
