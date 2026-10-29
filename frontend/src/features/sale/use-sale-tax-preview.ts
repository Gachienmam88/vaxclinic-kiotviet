"use client";

import { useEffect } from "react";
import { api } from "@/lib/api-client";
import { toBody } from "./sale-invoice-body";
import { taxPreviewKey, taxReductionActive } from "./sale-tax-reduction";
import type { DraftInvoice } from "./sale-types";
import { cartTotals, type SaleTabs } from "./use-sale-tabs";

type Preview = { taxReduction: number; method: string | null };

/**
 * Bật "Giảm thuế" ở tab đang mở → hỏi server số giảm thuế đúng (server tự tra cờ + thuế suất của hàng và phương pháp
 * tính thuế, như khi lưu hóa đơn). Kết quả gắn khóa giỏ hàng; giỏ đổi thì hỏi lại (chờ 300 ms). Mất mạng: giữ ước tính.
 */
export function useSaleTaxPreview(tabs: SaleTabs, branchId: string) {
  const d: DraftInvoice | undefined = tabs.active;
  const on = !!d?.taxReduction && d.kind !== "ORDER" && d.kind !== "RETURN" && !!d.lines.length && taxReductionActive();
  const key = d && on ? taxPreviewKey(d, cartTotals(d).discount) : "";
  const stale = on && d?.taxCutPreview?.key !== key;

  useEffect(() => {
    if (!d || !stale) return;
    let alive = true;
    const timer = setTimeout(() => {
      const body = toBody(d, branchId, undefined, false);
      api<Preview>("/invoices/tax-reduction-preview", { method: "POST", body: { lines: body.lines, discount: body.discount } })
        .then((r) => { if (alive) tabs.update({ taxCutPreview: { key, amount: Number(r.taxReduction), method: r.method } }); })
        .catch(() => undefined); // mất mạng: dùng ước tính, server tính lại khi lưu
    }, 300);
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ hỏi lại khi khóa giỏ hàng đổi
  }, [key, stale, d?.id]);
}
