import { api } from "@/lib/api-client";
import { newKey } from "@/features/products/product-form-state";
import type { ProductDetail } from "@/features/products/product-types";
import { fromLocalInput, toLocalInput, type LineForm } from "./purchase-line-form";
import type { DocStatus, PurchaseReturn, Receipt, ReturnableLine, VatMode } from "./purchase-types";

export type EditorMode = "receipt" | "return";

/** Toàn bộ trạng thái màn soạn phiếu nhập / trả hàng nhập. */
export type EditorState = {
  id: string | null; // null = phiếu mới
  code: string | null;
  status: DocStatus | null; // null = phiếu mới; COMPLETED = "Mở phiếu" trên phiếu đã nhập (chỉ nút Lưu)
  branchId: string;
  supplier: { id: string; name: string } | null;
  at: string; // datetime-local
  personId: string; // người nhập / người trả
  inputInvoiceNo: string;
  /** Hóa đơn đầu vào đang lập phiếu (gắn "Đã lập phiếu" sau khi lưu). */
  inputInvoiceId: string | null;
  vatRate: number | null; // VAT mặc định cho dòng mới thêm
  vatMode: VatMode;
  vatAmount: number; // VAT nhập tay (vatMode = MANUAL)
  discount: number;
  paid: number; // tiền đã trả NCC / NCC đã hoàn
  paymentMethod: "CASH" | "TRANSFER";
  /** Phiếu chi PC{mã} đã lập (lúc Lưu tạm / Hoàn thành) → tiền trả khóa. */
  paymentPosted: boolean;
  note: string;
  receiptId: string | null; // trả theo phiếu nhập
  receiptCode: string | null;
  lines: LineForm[];
};

export const emptyEditor = (branchId: string, personId: string): EditorState => ({
  id: null, code: null, status: null, branchId, supplier: null, at: toLocalInput(new Date().toISOString()), personId,
  inputInvoiceNo: "", inputInvoiceId: null, vatRate: null, vatMode: "LINE", vatAmount: 0, discount: 0, paid: 0, paymentMethod: "CASH",
  paymentPosted: false, note: "", receiptId: null, receiptCode: null, lines: [],
});

export type DocLine = { productId: string; unitId: string; quantity: number; unitPrice: number; discount?: number;
  lotNumber: string | null; expiryDate?: string | null; vatRate?: number | null; note?: string | null; id?: string };

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
      lotNumber: l.lotNumber ?? "", expiryDate: l.expiryDate ?? "", vatRate: l.vatRate == null ? null : Number(l.vatRate),
      note: l.note ?? "", lineId: l.id,
    };
  });
}

/** copy = true: "Sao chép" thành phiếu mới (bỏ id/mã, ngày = hiện tại). Phiếu đã nhập mở ra ở chế độ sửa (chỉ Lưu). */
export async function editorFromReceipt(r: Receipt, copy: boolean): Promise<EditorState> {
  return {
    id: copy ? null : r.id, code: copy ? null : r.code, status: copy ? null : r.status, branchId: r.branchId,
    supplier: r.supplierId ? { id: r.supplierId, name: r.supplierName ?? "" } : null,
    at: toLocalInput(copy ? new Date().toISOString() : r.receivedAt), personId: r.receiverId ?? "",
    inputInvoiceNo: copy ? "" : r.inputInvoiceNo ?? "", inputInvoiceId: null, vatRate: r.vatRate == null ? null : Number(r.vatRate),
    vatMode: r.vatMode ?? "LINE", vatAmount: Number(r.vatAmount), discount: Number(r.discount), paid: copy ? 0 : Number(r.paidAmount),
    paymentMethod: r.paymentMethod === "TRANSFER" ? "TRANSFER" : "CASH", paymentPosted: !copy && r.paymentPosted,
    note: copy ? "" : r.note ?? "", receiptId: null, receiptCode: null,
    lines: await linesFromDoc(r.lines.map((l) => ({ ...l, id: copy ? undefined : l.id }))),
  };
}

/**
 * Trả hàng nhập theo 1 phiếu nhập (KiotViet): mọi dòng, SL trả 0 / còn trả được, giá nhập = đơn giá − giảm giá,
 * giá trả lại mặc định = giá nhập, VAT% = VAT% của dòng nhập.
 */
export async function returnEditorFromReceipt(r: Receipt, personId: string): Promise<EditorState> {
  const rows = await api<ReturnableLine[]>(`/purchase-receipts/${r.id}/returnable`);
  const left = new Map(rows.map((x) => [x.lineId, Number(x.returnable)]));
  const vat = new Map(rows.map((x) => [x.lineId, x.defaultVatRate == null ? null : Number(x.defaultVatRate)]));
  const lines = await linesFromDoc(r.lines.map((l) => ({ ...l, unitPrice: Number(l.unitPrice) - Number(l.discount), discount: 0, id: undefined })));
  r.lines.forEach((l, i) => {
    lines[i].quantity = 0;
    lines[i].maxQty = left.get(l.id) ?? 0;
    lines[i].purchasePrice = Number(l.unitPrice) - Number(l.discount);
    lines[i].note = "";
    lines[i].vatRate = vat.has(l.id) ? vat.get(l.id) ?? null : lines[i].vatRate;
  });
  return { ...emptyEditor(r.branchId, personId), supplier: r.supplierId ? { id: r.supplierId, name: r.supplierName ?? "" } : null,
    vatRate: r.vatRate == null ? null : Number(r.vatRate), receiptId: r.id, receiptCode: r.code, lines };
}

/** Mở phiếu trả tạm: theo phiếu nhập thì tải lại "còn trả được" + giá nhập để hiện "/N". */
export async function editorFromReturn(r: PurchaseReturn): Promise<EditorState> {
  const lines = await linesFromDoc(r.lines);
  if (r.receiptId) {
    const [receipt, left] = await Promise.all([api<Receipt>(`/purchase-receipts/${r.receiptId}`),
      api<ReturnableLine[]>(`/purchase-receipts/${r.receiptId}/returnable`)]);
    lines.forEach((l) => {
      const src = receipt.lines.find((x) => x.productId === l.productId && (x.lotNumber ?? "") === l.lotNumber);
      if (!src) return;
      l.purchasePrice = Number(src.unitPrice) - Number(src.discount);
      l.maxQty = Number(left.find((x) => x.lineId === src.id)?.returnable ?? 0);
    });
  }
  return {
    ...emptyEditor(r.branchId, r.returnerId ?? ""), id: r.id, code: r.code, status: r.status,
    supplier: r.supplierId ? { id: r.supplierId, name: r.supplierName ?? "" } : null, at: toLocalInput(r.returnedAt),
    vatRate: r.vatRate == null ? null : Number(r.vatRate), vatMode: r.vatMode ?? "LINE", vatAmount: Number(r.vatAmount),
    discount: Number(r.discount), paid: Number(r.refundAmount), paymentMethod: r.paymentMethod === "TRANSFER" ? "TRANSFER" : "CASH",
    note: r.note ?? "", receiptId: r.receiptId, receiptCode: r.receiptCode, lines,
  };
}

/** payNow: Lưu tạm có tiền trả NCC và người dùng chọn lưu phiếu chi ngay. */
export function toRequest(mode: EditorMode, s: EditorState, personName: string, payNow = false) {
  const common = {
    branchId: s.branchId, supplierId: s.supplier?.id ?? null, vatRate: s.vatRate, vatMode: s.vatMode,
    vatAmount: s.vatMode === "MANUAL" ? s.vatAmount : null, discount: s.discount, note: s.note,
  };
  if (mode === "receipt") {
    return { ...common, receivedAt: fromLocalInput(s.at), receiverId: s.personId || null, receiverName: personName,
      inputInvoiceNo: s.inputInvoiceNo, paidAmount: s.paid, paymentMethod: s.paymentMethod, payNow,
      lines: s.lines.map((l) => ({ id: l.lineId ?? null, productId: l.productId, unitId: l.unitId, quantity: l.quantity,
        unitPrice: l.unitPrice, discount: l.discount, lotNumber: l.lotNumber, expiryDate: l.expiryDate || null,
        vatRate: s.vatMode === "MANUAL" ? null : l.vatRate ?? null, note: l.note || null })) };
  }
  return { ...common, receiptId: s.receiptId, returnedAt: fromLocalInput(s.at), returnerId: s.personId || null,
    returnerName: personName, refundAmount: s.paid, paymentMethod: s.paymentMethod,
    lines: s.lines.filter((l) => l.quantity > 0).map((l) => ({ productId: l.productId, unitId: l.unitId, quantity: l.quantity,
      unitPrice: l.unitPrice, lotNumber: l.lotNumber, vatRate: s.vatMode === "MANUAL" ? null : l.vatRate ?? null,
      note: l.note || null })) };
}
