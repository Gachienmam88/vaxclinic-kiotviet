"use client";

import { usePrinter } from "@/features/print/print-button";
import { voucherData } from "@/features/print/print-data";
import type { SupplierDebtDoc } from "./supplier-types";

const FUND: Record<string, string> = { CASH: "CASH", TRANSFER: "BANK", EWALLET: "EWALLET" };

/** In phiếu chi trả NCC theo mẫu "Phiếu chi" của cửa hàng, dựng từ chính phiếu công nợ (không chờ Sổ quỹ đồng bộ). */
export function useSupplierPaymentPrinter() {
  const print = usePrinter();
  return (d: SupplierDebtDoc, supplierPhone?: string | null) =>
    print("CASH_PAYMENT", voucherData({
      code: d.code, voucherType: "PAYMENT", occurredAt: d.occurredAt, partnerName: d.supplierName, partnerPhone: supplierPhone ?? null,
      category: "Chi Tiền trả NCC", amount: d.amount, fund: FUND[d.paymentMethod ?? "CASH"] ?? "CASH", note: d.note,
      createdByName: d.staffName ?? d.createdByName,
    }), d.branchId);
}
