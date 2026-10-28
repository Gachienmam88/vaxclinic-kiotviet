import { api } from "@/lib/api-client";
import type { Invoice } from "@/features/sales/sales-types";
import { newId } from "./pos-storage";
import type { CatalogProduct, DraftInvoice } from "./pos-types";

/**
 * Mở 1 hóa đơn đã bán lên màn bán hàng:
 * - "edit": tab Update_HDxxx với đúng giỏ hàng, khách, tiền đã trả → Thanh toán = lưu bản sửa (PUT, kèm revision).
 * - "return": tab "Trả hàng / HDxxx" với từng dòng: đã mua / đã trả / giá → chọn số lượng trả.
 * Cần có mạng (dữ liệu hóa đơn nằm trên server).
 */
export async function draftFromInvoice(invoiceId: string, mode: "edit" | "return", catalog: CatalogProduct[],
                                       sellerId: string): Promise<DraftInvoice> {
  const inv = await api<Invoice>(`/invoices/${invoiceId}`);
  if (inv.status !== "COMPLETED") throw new Error("Hóa đơn đã hủy");
  const customer = inv.customerId ? { id: inv.customerId, code: inv.customerCode ?? "", name: inv.customerName, phone: inv.customerPhone } : null;
  if (mode === "return") {
    return {
      id: newId(), kind: "RETURN", label: `Trả hàng / ${inv.code}`, mode: "QUICK", customer, sellerId, lines: [],
      discount: 0, paid: null, paymentMethod: "CASH", note: "",
      returnOf: {
        invoiceId: inv.id, code: inv.code, fee: 0, refund: null,
        lines: inv.lines.map((l) => ({ invoiceLineId: l.id, productCode: l.productCode, productName: l.productName,
          unitName: l.unitName, sold: Number(l.quantity), returned: Number(l.returnedQuantity ?? 0), price: Number(l.price), quantity: 0 })),
      },
    };
  }
  return {
    id: inv.id, kind: "EDIT", editOf: { invoiceId: inv.id, code: inv.code, revision: inv.revision },
    label: `Update_${inv.code}`, mode: "QUICK", customer, sellerId: inv.sellerId ?? sellerId,
    discount: Number(inv.discount), paid: Number(inv.paid), paymentMethod: (inv.paymentMethod ?? "CASH") as DraftInvoice["paymentMethod"],
    note: inv.note ?? "",
    lines: inv.lines.map((l) => {
      const p = catalog.find((x) => x.id === l.productId);
      const units = p?.units.length ? p.units
        : [{ id: l.unitId, code: l.productCode, barcode: null, unitName: l.unitName, conversionRate: 1, price: Number(l.unitPrice) }];
      return { key: newId(), productId: l.productId, productName: l.productName, unitId: l.unitId, units,
        quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discount: Number(l.discount), note: l.note ?? "",
        taxCode: l.taxCode ?? p?.taxCode ?? null };
    }),
  };
}
