"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { saleNs } from "@/messages/sale";
import { usePaymentMethodLabel, SALE_PAYMENT_METHODS } from "./sale-ui-parts";
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

const FIELDS = [["INDEX", "settings.sort.index"], ["CODE", "settings.sort.code"], ["NAME", "settings.sort.name"]] as const;

/** Hàng hóa: hiển thị cột / thông tin dòng hàng + cách thêm, sắp xếp hàng trong giỏ. */
export function GoodsTab({ s, set }: TabProps) {
  const t = useT(saleNs);
  const dir = (desc: boolean) => `grid size-7 place-items-center rounded ${s.sortDesc === desc ? "bg-primary text-white" : "bg-[#eef0f3]"}`;
  return (
    <>
      <Section title={t("settings.display")}>
        <div className="grid grid-cols-2 gap-x-4">
          <Check s={s} set={set} label={t("settings.goods.image")} disabled tip={t("settings.goods.imageTip")} />
          <Check s={s} set={set} k="showCode" label={t("settings.sort.code")} />
          <Check s={s} set={set} k="showStock" label={t("settings.goods.stock")} tip={t("settings.goods.stockTip")} />
          <Check s={s} set={set} k="showLineNote" label={t("settings.goods.lineNote")} tip={t("settings.goods.lineNoteTip")} />
        </div>
      </Section>
      <Section title={t("settings.options")}>
        <Toggle s={s} set={set} k="mergeSameItems" label={t("settings.goods.merge")} tip={t("settings.goods.mergeTip")} />
        <Toggle s={s} set={set} k="addLine" label={t("line.addLine")} tip={t("settings.goods.addLineTip")} />
        <label className="flex h-9 items-center justify-between gap-4">{t("settings.goods.sortBy")}
          <select aria-label={t("settings.goods.sortBy")} value={s.sortField} onChange={(e) => set({ sortField: e.target.value as SaleSortField })}
            className="h-8 min-w-[134px] rounded bg-[#eef0f3] px-2 outline-none">
            {FIELDS.map(([v, l]) => <option key={v} value={v}>{t(l)}: {t(s.sortDesc ? "settings.sort.desc" : "settings.sort.asc")}</option>)}
          </select></label>
        <Toggle s={s} set={set} k="dragDrop" label={t("settings.goods.dragDrop")} tip={t("settings.goods.dragDropTip")} />
        <Toggle s={s} set={set} k="multiSelect" label={t("search.multiSelect")} />
        <Toggle s={s} set={set} k="scanQuickAdd" label={t("search.scanQuickAdd")} tip={t("settings.goods.scanTip")} />
        <Toggle s={s} set={set} k="showIndex" label={t("settings.sort.index")} />
        <div className="flex h-9 items-center justify-between">{t("settings.goods.sortOrder")}
          <span className="flex gap-1.5">
            <button type="button" aria-label={t("settings.sort.asc")} aria-pressed={!s.sortDesc} className={dir(false)} onClick={() => set({ sortDesc: false })}><ArrowUp className="size-4" /></button>
            <button type="button" aria-label={t("settings.sort.desc")} aria-pressed={s.sortDesc} className={dir(true)} onClick={() => set({ sortDesc: true })}><ArrowDown className="size-4" /></button>
          </span></div>
        <Toggle s={s} set={set} k="showAmount" label={t("line.amount")} />
        <Toggle s={s} set={set} k="suggestPaid" label={t("settings.goods.suggestPaid")} />
      </Section>
    </>
  );
}

/** Giá tiền: cột giá bán, giá bán gần nhất của khách, kiểu giảm giá mặc định, sửa thành tiền. */
export function PriceTab({ s, set }: TabProps) {
  const t = useT(saleNs);
  const pill = (on: boolean) => `h-6 rounded px-2 text-xs font-bold ${on ? "bg-primary text-white" : "bg-[#eef0f3]"}`;
  return (
    <>
      <Section title={t("settings.display")}>
        <div className="grid grid-cols-2 gap-x-4">
          <Check s={s} set={set} k="showPrice" label={t("settings.price.price")} />
          <Check s={s} set={set} k="showLastPrice" label={t("settings.price.lastPrice")} tip={t("settings.price.lastPriceTip")} />
        </div>
      </Section>
      <Section title={t("settings.options")}>
        <div className="flex h-9 items-center justify-between">
          <span className="flex items-center gap-1.5">{t("line.discount")} <Tip text={t("settings.price.discountTip")} /></span>
          <span className="flex gap-1">
            <button type="button" className={pill(s.discountType === "VND")} onClick={() => set({ discountType: "VND" })}>VND</button>
            <button type="button" className={pill(s.discountType === "PERCENT")} onClick={() => set({ discountType: "PERCENT" })}>%</button>
          </span></div>
        <Toggle s={s} set={set} k="editAmount" label={t("settings.price.editAmount")} tip={t("settings.price.editAmountTip")} />
      </Section>
    </>
  );
}

/** Thanh toán: phương thức mặc định, tiền khách trả mặc định, tự hoàn thành khi nhận tiền QR (khi bật SePay), đọc số tiền. */
export function PaymentTab({ s, set }: TabProps) {
  const t = useT(saleNs);
  const methodLabel = usePaymentMethodLabel();
  const { data: sepay } = useQuery({ queryKey: ["sepay-settings"], queryFn: () => api<{ enabled: boolean }>("/payments/sepay/settings"), retry: false });
  return (
    <Section title={t("settings.options")}>
      <label className="flex min-h-9 items-center justify-between gap-4">{t("settings.payment.defaultMethod")}
        <select aria-label={t("settings.payment.defaultMethod")} value={s.defaultPaymentMethod}
          onChange={(e) => set({ defaultPaymentMethod: e.target.value as SaleSettings["defaultPaymentMethod"] })}
          className="h-8 w-[134px] rounded bg-[#eef0f3] px-2 outline-none">
          {SALE_PAYMENT_METHODS.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
        </select></label>
      <Toggle s={s} set={set} k="paidEqualsDue" label={t("settings.payment.paidEqualsDue")} tip={t("settings.payment.paidEqualsDueTip")} />
      {sepay?.enabled && <Toggle s={s} set={set} k="autoCompleteQr" label={t("settings.payment.autoCompleteQr")}
        tip={t("settings.payment.autoCompleteQrTip")} />}
      <Toggle s={s} set={set} k="speakPaid" label={t("settings.payment.speakPaid")} tip={t("settings.payment.speakPaidTip")} />
    </Section>
  );
}
