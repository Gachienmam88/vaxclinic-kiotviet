import { api } from "@/lib/api-client";
import type { Supplier } from "@/features/purchases/purchase-types";
import type { SupplierPage, SupplierRow } from "@/features/purchases/supplier-types";
import type { InputInvoice } from "./integration-queries";
import { findSupplierByTaxCode } from "./input-invoice-receipt-draft";

/** Tạo NCC từ thông tin người bán trên hóa đơn (MST, tên, địa chỉ). */
export const createSupplierFromSeller = (inv: InputInvoice) =>
  api<Supplier>("/suppliers", { method: "POST", body: {
    name: inv.sellerName ?? inv.sellerTaxCode, taxCode: inv.sellerTaxCode, companyName: inv.sellerName,
    address: inv.sellerAddress ?? null,
  } });

/** Dòng NCC kèm nợ hiện tại (popup Thanh toán cần "Nợ hiện tại"). */
export async function supplierRow(s: Supplier): Promise<SupplierRow> {
  const page = await api<SupplierPage>(`/suppliers?q=${encodeURIComponent(s.code)}&size=5`);
  return page.items.find((x) => x.id === s.id) ?? { ...s, branchId: null, createdByName: null, createdAt: "", debt: 0, totalBuy: 0 };
}

/**
 * NCC của hóa đơn theo MST người bán; chưa có → hỏi (confirmCreate) rồi tạo từ thông tin người bán.
 * Trả null khi người dùng không đồng ý tạo.
 */
export async function ensureSupplierRow(inv: InputInvoice, confirmCreate: () => boolean): Promise<SupplierRow | null> {
  let s = await findSupplierByTaxCode(inv.sellerTaxCode);
  if (!s) {
    if (!confirmCreate()) return null;
    s = await createSupplierFromSeller(inv);
  }
  return supplierRow(s);
}
