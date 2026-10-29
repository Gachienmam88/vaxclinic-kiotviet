"use client";

import { useT } from "@/lib/i18n";
import { saleNs } from "@/messages/sale";
import { lineField } from "./sale-delivery-draft";
import type { DraftInvoice, Prescription } from "./sale-types";

const EMPTY: Prescription = { code: "", doctor: "", facility: "", diagnosis: "" };
const FIELDS = [["code", 50], ["doctor", 150], ["facility", 250], ["diagnosis", 500]] as const;

/**
 * Ô "Bán thuốc theo đơn": tích → nhập mã đơn thuốc, bác sĩ kê đơn, cơ sở khám, chẩn đoán (lưu trên hóa đơn, hiện ở chi tiết
 * và bản in). Vẫn là hóa đơn bán bình thường (trừ kho như thường). Chưa kết nối Hệ thống Đơn thuốc Quốc gia → chỉ ghi chú,
 * không tra cứu / đồng bộ.
 */
export function SalePrescriptionFields({ draft, update }: { draft: DraftInvoice; update: (p: Partial<DraftInvoice>) => void }) {
  const t = useT(saleNs);
  if (draft.kind === "ORDER" || draft.kind === "RETURN") return null;
  const p = draft.prescription;
  return (
    <div className="mt-2.5">
      <label className="flex cursor-pointer items-center gap-2.5 text-[13px]">
        <input type="checkbox" className="size-4 accent-primary" checked={!!p} onChange={(e) => update({ prescription: e.target.checked ? { ...EMPTY } : null })} />
        {t("prescription.label")}
      </label>
      {p && (
        <div className="mt-1.5 space-y-1 pl-6">
          {FIELDS.map(([k, max]) => (
            <input key={k} className={lineField} maxLength={max} aria-label={t(`prescription.fields.${k}`)} placeholder={t(`prescription.fields.${k}`)}
              value={p[k]} onChange={(e) => update({ prescription: { ...p, [k]: e.target.value } })} />))}
          <p className="pt-0.5 text-[11px] text-[#6b7280]">{t("prescription.notConnected")}</p>
        </div>)}
    </div>
  );
}
