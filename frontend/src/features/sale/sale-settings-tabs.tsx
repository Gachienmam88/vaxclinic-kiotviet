"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { PAYMENT_METHODS } from "@/features/sales/sales-types";
import { api } from "@/lib/api-client";
import type { SaleSettings, SaleSortField } from "./sale-settings";

type TabProps = { s: SaleSettings; set: (p: Partial<SaleSettings>) => void };
type BoolKey = { [K in keyof SaleSettings]: SaleSettings[K] extends boolean ? K : never }[keyof SaleSettings];

const Tip = ({ text }: { text: string }) => <span title={text} className="text-[#4b5563]"><Info className="size-3.5" /></span>;

function Check({ s, set, k, label, tip, disabled }: TabProps & { k?: BoolKey; label: string; tip?: string; disabled?: boolean }) {
  return (
    <label className={`flex h-8 items-center gap-2.5 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`} title={disabled ? tip : undefined}>
      <Checkbox checked={k ? s[k] : false} disabled={disabled} onCheckedChange={(v) => k && set({ [k]: v === true })} />{label}
      {tip && !disabled && <Tip text={tip} />}
    </label>
  );
}

function Toggle({ s, set, k, label, tip }: TabProps & { k: BoolKey; label: string; tip?: string }) {
  return (
    <label className="flex min-h-8 cursor-pointer items-center justify-between gap-4">
      <span className="flex items-center gap-1.5">{label}{tip && <Tip text={tip} />}</span>
      <Switch checked={s[k]} onCheckedChange={(v) => set({ [k]: v })} />
    </label>
  );
}

export const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="border-b border-[#e5e7eb] pb-3 last:border-0 [&+&]:pt-3"><p className="mb-1.5 text-xs font-bold">{title}</p>{children}</div>
);

const FIELDS: [SaleSortField, string][] = [["INDEX", "Số thứ tự"], ["CODE", "Mã hàng"], ["NAME", "Tên hàng"]];

/** Hàng hóa: hiển thị cột / thông tin dòng hàng + cách thêm, sắp xếp hàng trong giỏ. */
export function GoodsTab({ s, set }: TabProps) {
  const dir = (desc: boolean) => `grid size-7 place-items-center rounded ${s.sortDesc === desc ? "bg-primary text-white" : "bg-[#eef0f3]"}`;
  return (
    <>
      <Section title="Hiển thị">
        <div className="grid grid-cols-2 gap-x-4">
          <Check s={s} set={set} label="Ảnh hàng hóa" disabled tip="Hàng hóa chưa có ảnh" />
          <Check s={s} set={set} k="showCode" label="Mã hàng" />
          <Check s={s} set={set} k="showStock" label="Tồn kho" tip="Hiện số tồn dưới tên hàng (theo đơn vị đang bán)" />
          <Check s={s} set={set} k="showLineNote" label="Ghi chú hàng hóa" tip="Luôn hiện ô ghi chú dưới mỗi dòng hàng" />
        </div>
      </Section>
      <Section title="Cài đặt">
        <Toggle s={s} set={set} k="mergeSameItems" label="Gộp hàng hóa liên quan" tip="Thêm hàng đã có trong đơn → tăng số lượng thay vì thêm dòng mới" />
        <Toggle s={s} set={set} k="addLine" label="Thêm dòng" tip="Hiện nút (+) trên dòng để thêm 1 dòng mới cùng hàng hóa" />
        <label className="flex h-9 items-center justify-between gap-4">Sắp xếp hàng hóa theo
          <select aria-label="Sắp xếp hàng hóa theo" value={s.sortField} onChange={(e) => set({ sortField: e.target.value as SaleSortField })}
            className="h-8 min-w-[134px] rounded bg-[#eef0f3] px-2 outline-none">
            {FIELDS.map(([v, l]) => <option key={v} value={v}>{l}: {s.sortDesc ? "Giảm dần" : "Tăng dần"}</option>)}
          </select></label>
        <Toggle s={s} set={set} k="dragDrop" label="Kéo thả hàng hóa" tip="Kéo thả dòng hàng để đổi thứ tự (khi sắp xếp theo số thứ tự)" />
        <Toggle s={s} set={set} k="multiSelect" label="Chế độ chọn nhiều hàng hóa" />
        <Toggle s={s} set={set} k="scanQuickAdd" label="Quét mã để thêm hàng hóa nhanh" tip="Quét / gõ đúng mã hàng là thêm ngay, không cần Enter" />
        <Toggle s={s} set={set} k="showIndex" label="Số thứ tự" />
        <div className="flex h-9 items-center justify-between">Sắp xếp thứ tự hàng hóa
          <span className="flex gap-1.5">
            <button type="button" aria-label="Tăng dần" aria-pressed={!s.sortDesc} className={dir(false)} onClick={() => set({ sortDesc: false })}><ArrowUp className="size-4" /></button>
            <button type="button" aria-label="Giảm dần" aria-pressed={s.sortDesc} className={dir(true)} onClick={() => set({ sortDesc: true })}><ArrowDown className="size-4" /></button>
          </span></div>
        <Toggle s={s} set={set} k="showAmount" label="Thành tiền" />
        <Toggle s={s} set={set} k="suggestPaid" label="Gợi ý khách thanh toán" />
      </Section>
    </>
  );
}

/** Giá tiền: cột giá bán, giá bán gần nhất của khách, kiểu giảm giá mặc định, sửa thành tiền. */
export function PriceTab({ s, set }: TabProps) {
  const pill = (on: boolean) => `h-6 rounded px-2 text-xs font-bold ${on ? "bg-primary text-white" : "bg-[#eef0f3]"}`;
  return (
    <>
      <Section title="Hiển thị">
        <div className="grid grid-cols-2 gap-x-4">
          <Check s={s} set={set} k="showPrice" label="Giá bán" />
          <Check s={s} set={set} k="showLastPrice" label="Giá bán gần nhất" tip="Giá đã bán gần nhất cho khách đang chọn, bấm để áp dụng" />
        </div>
      </Section>
      <Section title="Cài đặt">
        <div className="flex h-9 items-center justify-between">
          <span className="flex items-center gap-1.5">Giảm giá <Tip text="Kiểu nhập giảm giá mặc định của dòng hàng" /></span>
          <span className="flex gap-1">
            <button type="button" className={pill(s.discountType === "VND")} onClick={() => set({ discountType: "VND" })}>VND</button>
            <button type="button" className={pill(s.discountType === "PERCENT")} onClick={() => set({ discountType: "PERCENT" })}>%</button>
          </span></div>
        <Toggle s={s} set={set} k="editAmount" label="Chỉnh sửa thành tiền" tip="Sửa thành tiền của dòng → tự tính lại đơn giá" />
      </Section>
    </>
  );
}

/** Thanh toán: phương thức mặc định, tiền khách trả mặc định, tự hoàn thành khi nhận tiền QR (khi bật SePay), đọc số tiền. */
export function PaymentTab({ s, set }: TabProps) {
  const { data: sepay } = useQuery({ queryKey: ["sepay-settings"], queryFn: () => api<{ enabled: boolean }>("/payments/sepay/settings"), retry: false });
  return (
    <Section title="Cài đặt">
      <label className="flex min-h-9 items-center justify-between gap-4">Phương thức thanh toán mặc định
        <select aria-label="Phương thức thanh toán mặc định" value={s.defaultPaymentMethod}
          onChange={(e) => set({ defaultPaymentMethod: e.target.value as SaleSettings["defaultPaymentMethod"] })}
          className="h-8 w-[134px] rounded bg-[#eef0f3] px-2 outline-none">
          {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select></label>
      <Toggle s={s} set={set} k="paidEqualsDue" label="Tiền khách thanh toán bằng khách cần trả" tip="Tắt: hóa đơn mới để Khách thanh toán = 0" />
      {sepay?.enabled && <Toggle s={s} set={set} k="autoCompleteQr" label="Tự động hoàn thành đơn hàng khi quét QR thành công"
        tip="Nhận đủ tiền chuyển khoản qua QR (SePay) → tự thanh toán hóa đơn" />}
      <Toggle s={s} set={set} k="speakPaid" label="Phát loa số tiền khách thanh toán" tip="Đọc số tiền khách thanh toán khi thanh toán xong" />
    </Section>
  );
}
