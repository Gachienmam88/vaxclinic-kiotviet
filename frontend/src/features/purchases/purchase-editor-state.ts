import { api } from "@/lib/api-client";
import { newKey } from "@/features/products/product-form-state";
import type { ProductDetail } from "@/features/products/product-types";
import { fromLocalInput, toLocalInput, type LineForm } from "./purchase-line-form";
import type { PurchaseReturn, Receipt } from "./purchase-types";

export type EditorMode = "receipt" | "return";

/** Toàn bộ trạng thái màn soạn phiếu nhập / trả hàng nhập. */
export type EditorState = {
  id: string | null; // null = phiếu mới
  code: string | null;
  branchId: string;
  supplier: { id: string; name: string } | null;
  at: string; // datetime-local
  personId: string; // người nhập / người trả
  inputInvoiceNo: string;
  vatRate: number | null;
  discount: number;
  paid: number; // tiền đã trả NCC / NCC đã hoàn
  paymentMethod: "CASH" | "TRANSFER";
  note: string;
  receiptId: string | null; // trả theo phiếu nhập
  receiptCode: string | null;
  lines: LineForm[];
};

export const emptyEditor = (branchId: string, personId: string): EditorState => ({
  id: null, code: null, branchId, supplier: null, at: toLocalInput(new Date().toISOString()), personId,
  inputInvoiceNo: "", vatRate: null, discount: 0, paid: 0, paymentMethod: "CASH", note: "",
  receiptId: null, receiptCode: null, lines: [],
});

export type DocLine = { productId: string; unitId: string; quantity: number; unitPrice: number; discount?: number;
  lotNumber: string | null; expiryDate?: string | null };

/** Dựng dòng soạn từ dòng chứng từ đã lưu (cần tải chi tiết hàng để có danh sách đơn vị). */
export async function linesFromDoc(lines: DocLine[]): Promise<LineForm[]> {
  const ids = [...new Set(lines.map((l) => l.productId))];
  const products = new Map((await Promise.all(ids.map((id) => api<ProductDetail>(`/products/${id}`)))).map((p) => [p.id, p]));
  return lines.map((l) => {
    const p = products.get(l.productId)!;
    return {
      key: newKey(), productId: p.id, productName: p.name, lotManaged: p.lotManaged,
      units: p.units.map((u) => ({ id: u.id, code: u.code, unitName: u.unitName, conversionRate: Number(u.conversionRate) })),
      unitId: l.unitId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discount: Number(l.discount ?? 0),
      lotNumber: l.lotNumber ?? "", expiryDate: l.expiryDate ?? "",
    };
  });
}

/** copy = true: "Sao chép" thành phiếu mới (bỏ id/mã, ngày = hiện tại). */
export async function editorFromReceipt(r: Receipt, copy: boolean): Promise<EditorState> {
  return {
    id: copy ? null : r.id, code: copy ? null : r.code, branchId: r.branchId,
    supplier: r.supplierId ? { id: r.supplierId, name: r.supplierName ?? "" } : null,
    at: toLocalInput(copy ? new Date().toISOString() : r.receivedAt), personId: r.receiverId ?? "",
    inputInvoiceNo: copy ? "" : r.inputInvoiceNo ?? "", vatRate: r.vatRate == null ? null : Number(r.vatRate),
    discount: Number(r.discount), paid: copy ? 0 : Number(r.paidAmount),
    paymentMethod: r.paymentMethod === "TRANSFER" ? "TRANSFER" : "CASH", note: copy ? "" : r.note ?? "",
    receiptId: null, receiptCode: null, lines: await linesFromDoc(r.lines),
  };
}

/** Tạo phiếu trả theo 1 phiếu nhập: điền sẵn các dòng (giá trả = đơn giá nhập − giảm giá). */
export async function returnEditorFromReceipt(r: Receipt, personId: string): Promise<EditorState> {
  const lines = await linesFromDoc(r.lines.map((l) => ({ ...l, unitPrice: Number(l.unitPrice) - Number(l.discount), discount: 0 })));
  return { ...emptyEditor(r.branchId, personId), supplier: r.supplierId ? { id: r.supplierId, name: r.supplierName ?? "" } : null,
    vatRate: r.vatRate == null ? null : Number(r.vatRate), receiptId: r.id, receiptCode: r.code, lines };
}

export async function editorFromReturn(r: PurchaseReturn): Promise<EditorState> {
  return {
    ...emptyEditor(r.branchId, r.returnerId ?? ""), id: r.id, code: r.code,
    supplier: r.supplierId ? { id: r.supplierId, name: r.supplierName ?? "" } : null, at: toLocalInput(r.returnedAt),
    vatRate: r.vatRate == null ? null : Number(r.vatRate), discount: Number(r.discount), paid: Number(r.refundAmount),
    note: r.note ?? "", receiptId: r.receiptId, receiptCode: r.receiptCode, lines: await linesFromDoc(r.lines),
  };
}

export function toRequest(mode: EditorMode, s: EditorState, personName: string) {
  const common = {
    branchId: s.branchId, supplierId: s.supplier?.id ?? null, vatRate: s.vatRate, discount: s.discount, note: s.note,
  };
  if (mode === "receipt") {
    return { ...common, receivedAt: fromLocalInput(s.at), receiverId: s.personId || null, receiverName: personName,
      inputInvoiceNo: s.inputInvoiceNo, paidAmount: s.paid, paymentMethod: s.paymentMethod,
      lines: s.lines.map((l) => ({ productId: l.productId, unitId: l.unitId, quantity: l.quantity, unitPrice: l.unitPrice,
        discount: l.discount, lotNumber: l.lotNumber, expiryDate: l.expiryDate || null })) };
  }
  return { ...common, receiptId: s.receiptId, returnedAt: fromLocalInput(s.at), returnerId: s.personId || null,
    returnerName: personName, refundAmount: s.paid,
    lines: s.lines.map((l) => ({ productId: l.productId, unitId: l.unitId, quantity: l.quantity, unitPrice: l.unitPrice,
      lotNumber: l.lotNumber })) };
}
