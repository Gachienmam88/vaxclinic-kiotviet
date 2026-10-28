/** Kiểu dữ liệu màn bán hàng (POS). */

export type CatalogUnit = { id: string; code: string; barcode: string | null; unitName: string; conversionRate: number; price: number };
export type CatalogProduct = {
  id: string; name: string; lotManaged: boolean; stock: number; taxCode: string | null; units: CatalogUnit[];
};

export type CartLine = {
  key: string;
  productId: string;
  productName: string;
  unitId: string;
  units: CatalogUnit[];
  quantity: number;
  unitPrice: number;
  discount: number; // giảm giá / 1 đơn vị
  note: string;
  taxCode: string | null; // mã thuế suất lúc bán → phát hành hóa đơn điện tử
};

export type PosCustomer = { id: string; code: string; name: string; phone: string | null; debt?: number };

/** 1 dòng trên tab trả hàng: số lượng trả tối đa = đã mua − đã trả. */
export type ReturnLine = {
  invoiceLineId: string; productCode: string; productName: string; unitName: string;
  sold: number; returned: number; price: number; quantity: number;
};

/**
 * 1 tab đang soạn. kind: SALE (bán mới), EDIT (sửa hóa đơn — "Update_HDxxx"), RETURN (trả hàng theo hóa đơn).
 * id = UUID gửi lên server (bán mới / phiếu trả: giữ nguyên khi gửi lại → không tạo trùng).
 */
export type DraftInvoice = {
  id: string;
  kind?: "SALE" | "EDIT" | "RETURN";
  editOf?: { invoiceId: string; code: string; revision: number };
  returnOf?: { invoiceId: string; code: string; lines: ReturnLine[]; fee: number; refund: number | null };
  label: string;
  mode: "QUICK" | "NORMAL";
  customer: PosCustomer | null;
  sellerId: string;
  lines: CartLine[];
  discount: number;
  paid: number | null; // null = khách trả đủ (mặc định)
  paymentMethod: "CASH" | "TRANSFER" | "CARD" | "EWALLET";
  note: string;
};

/** Hóa đơn đã bấm Thanh toán nhưng chưa lên server (mất mạng / lỗi). */
export type QueuedInvoice = {
  id: string;
  createdAt: string;
  body: Record<string, unknown>;
  customerName: string;
  total: number;
  status: "pending" | "error";
  error?: string;
};
