"use client";

import { toast } from "sonner";
import { usePrinter } from "@/features/print/print-button";
import { voucherData, type VoucherDoc } from "@/features/print/print-data";
import { api } from "@/lib/api-client";
import type { CashPage } from "./sales-types";

/**
 * "Tạo phiếu thu & In": sau khi thu nợ, API trả mã phiếu → tìm phiếu trong Sổ quỹ theo mã,
 * lấy chi tiết rồi in theo mẫu "Phiếu thu" của cửa hàng (dùng lại bộ in sẵn có).
 */
export function useDebtReceiptPrinter() {
  const print = usePrinter();
  return async (code: string, branchId?: string | null) => {
    try {
      const page = await api<CashPage>(`/cashbook?fund=ALL&q=${encodeURIComponent(code)}&size=5`);
      const item = page.items.find((i) => i.code === code);
      if (!item) throw new Error("not found");
      const detail = await api<{ voucher: VoucherDoc }>(`/cashbook/${item.id}`);
      print("CASH_RECEIPT", voucherData(detail.voucher), branchId);
    } catch {
      toast.error(`Đã tạo phiếu ${code} nhưng không in được — in lại tại Sổ quỹ`);
    }
  };
}
