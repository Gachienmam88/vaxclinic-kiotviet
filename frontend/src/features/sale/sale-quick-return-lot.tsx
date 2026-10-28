"use client";

import type { MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { DatePicker } from "@/components/ui/date-picker";
import { api } from "@/lib/api-client";
import { toYmd } from "@/lib/date-input-format";
import { formatDate, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { saleNs } from "@/messages/sale";

type Lot = { id: string; branchId: string; lotNumber: string; expiryDate: string; quantity: number };

/** Giá trị đặc biệt của ô chọn lô: chuyển sang nhập lô mới. */
const NEW_LOT = "__new__";

/**
 * Trả nhanh, hàng quản lý theo lô: chọn lô của điểm tiêm (kể cả lô đã bán hết) HOẶC nhập lô mới (số lô + HSD) → kho tạo lô.
 * expiry: undefined/null = đang chọn lô có sẵn; chuỗi ("" khi chưa nhập) = đang nhập lô mới. Danh sách lô cần mạng.
 */
export function SaleQuickReturnLot({ productId, branchId, value, expiry, onChange }: {
  productId: string; branchId: string; value: string | null | undefined; expiry: string | null | undefined;
  onChange: (patch: { lotNumber: string; lotExpiry: string | null }) => void;
}) {
  const t = useT(saleNs);
  const { data = [], isError } = useQuery({
    queryKey: ["product-lots", productId], queryFn: () => api<Lot[]>(`/products/${productId}/lots`), staleTime: 60_000,
  });
  const lots = data.filter((l) => l.branchId === branchId);
  const stop = (e: MouseEvent) => e.stopPropagation();

  if (typeof expiry === "string") {
    const typed = (value ?? "").trim();
    const same = lots.find((l) => l.lotNumber === typed);
    const mismatch = same && expiry && same.expiryDate !== expiry;
    const expired = expiry && expiry < toYmd(new Date());
    return (
      <div className="mt-0.5 space-y-0.5 text-xs text-[#6b7280]" onClick={stop}>
        <div className="flex flex-wrap items-center gap-1.5">
          {t("lot.newLot")}
          <input aria-label={t("lot.newLotNumber")} placeholder={t("lot.lotNumber")} maxLength={50} value={value ?? ""}
            onChange={(e) => onChange({ lotNumber: e.target.value, lotExpiry: expiry })}
            className={`h-6 w-28 rounded border bg-background px-1 text-xs outline-none ${typed ? "border-[#d6d9de]" : "border-destructive"}`} />
          {t("lot.expiry")}
          <DatePicker className="h-6 w-32 text-xs" aria-label={t("lot.newLotExpiry")} value={expiry}
            onChange={(v) => onChange({ lotNumber: value ?? "", lotExpiry: v })} />
          <button type="button" className="text-primary hover:underline" onClick={() => onChange({ lotNumber: "", lotExpiry: null })}>
            {t("lot.pickExisting")}
          </button>
        </div>
        {same && !mismatch && <div>{t("lot.exists", { lot: typed, expiry: formatDate(same.expiryDate) })}</div>}
        {mismatch && <div className="text-destructive">{t("lot.expiryMismatch", { lot: typed, expiry: formatDate(same.expiryDate) })}</div>}
        {expired && <div className="text-amber-600">{t("lot.expired")}</div>}
      </div>
    );
  }

  return (
    <label className="mt-0.5 flex items-center gap-1.5 text-xs text-[#6b7280]" onClick={stop}>
      {t("lot.lot")}
      <select aria-label={t("lot.returnLot")} value={value ?? ""}
        onChange={(e) => onChange(e.target.value === NEW_LOT ? { lotNumber: "", lotExpiry: "" } : { lotNumber: e.target.value, lotExpiry: null })}
        className={`h-6 max-w-56 rounded border bg-background px-1 text-xs outline-none ${value ? "border-[#d6d9de]" : "border-destructive"}`}>
        <option value="">{t(isError ? "lot.offline" : "lot.pick")}</option>
        {lots.map((l) => <option key={l.id} value={l.lotNumber}>{t("lot.option", { lot: l.lotNumber, expiry: formatDate(l.expiryDate), qty: formatNumber(l.quantity) })}</option>)}
        <option value={NEW_LOT}>{t("lot.enterNew")}</option>
      </select>
    </label>
  );
}
