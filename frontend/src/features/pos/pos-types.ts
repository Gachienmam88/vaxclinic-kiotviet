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

/** 1 tab hóa đơn đang soạn. id = UUID gửi lên server (giữ nguyên khi đồng bộ offline). */
export type DraftInvoice = {
  id: string;
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
