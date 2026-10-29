/** Kiểu dữ liệu màn bán hàng (sale). */
import type { GroupDiscount } from "@/features/sales/customer-group-discount";

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
  priceEdited: boolean; // thu ngân sửa đơn giá tay (hoặc giá của hóa đơn/đơn đã lưu) → đổi bảng giá không tính lại
  lotNumber?: string | null; // chỉ tab Trả nhanh: lô nhập lại (hàng quản lý theo lô)
  lotExpiry?: string | null; // chỉ tab Trả nhanh, nhập lô mới: HSD yyyy-MM-dd ("" = chưa nhập); null = chọn lô có sẵn
};

/**
 * groupDiscount: giảm giá nhóm khách — lưu cùng khách trên máy để mất mạng vẫn tự điền giảm giá.
 * groupId: nhóm khách → lọc bảng giá theo nhóm.
 */
export type SaleCustomer = {
  id: string; code: string; name: string; phone: string | null; debt?: number; groupId?: string | null; groupDiscount?: GroupDiscount | null;
};

/** Đơn đặt hàng gắn với tab: orderId/mã đơn + tiền khách đã trả (đặt cọc). */
export type OrderRef = { orderId: string; code: string; deposit: number };

/**
 * Thông tin giao hàng của tab "Bán giao hàng" → vận đơn tạo cùng hóa đơn. Thu hộ (COD) = khách cần trả − khách thanh toán.
 * feePayer: SHOP = cửa hàng trả phí cho đối tác; CUSTOMER = người nhận trả phí cho đối tác.
 */
export type DeliveryDraft = {
  partnerId: string; receiverName: string; receiverPhone: string; receiverAddress: string; area: string;
  weightGram: number | null; shippingFee: number; feePayer: "SHOP" | "CUSTOMER"; note: string;
  /** Khu vực theo ĐVHC 2 cấp (area = tên ghép); tab lưu từ bản cũ có thể thiếu. */
  provinceCode?: string; wardCode?: string; provinceName?: string; wardName?: string;
  /** Tự giao hàng (như KiotViet): loại dịch vụ, mã vận đơn của đối tác, thời gian giao (yyyy-MM-ddTHH:mm), trạng thái ban đầu. */
  serviceType?: "STANDARD" | "EXPRESS"; waybillCode?: string; expectedDeliveryAt?: string; status?: "PENDING" | "PICKING" | "DELIVERING" | "DELIVERED";
  /** Kiện hàng: số kiện, kích thước (cm); weightUnit chỉ để hiển thị (lưu weightGram). */
  packageCount?: number; lengthCm?: number | null; widthCm?: number | null; heightCm?: number | null; weightUnit?: "g" | "kg";
  /** Thu hộ tiền (COD): mặc định bật; tắt = phần khách chưa trả ghi công nợ khách. */
  codEnabled?: boolean;
};

/** Thông tin xuất hóa đơn điện tử của người mua (lưu trên hóa đơn). */
export type EInvoiceBuyer = { buyerName: string; companyName: string; taxCode: string; address: string; email: string; phone: string };

/** Phần thanh toán thêm bằng phương thức khác (Thanh toán nhiều phương thức) — chỉ hóa đơn bán mới. */
export type ExtraPayment = { method: "CASH" | "TRANSFER" | "CARD" | "EWALLET"; amount: number };

/** 1 dòng trên tab trả hàng: số lượng trả tối đa = đã mua − đã trả. */
export type ReturnLine = {
  invoiceLineId: string; productCode: string; productName: string; unitName: string;
  sold: number; returned: number; price: number; quantity: number;
};

/**
 * 1 tab đang soạn. kind: SALE (bán mới), EDIT (sửa hóa đơn — "Update_HDxxx"), RETURN (trả hàng theo hóa đơn),
 * ORDER (đặt hàng: không trừ kho, "Khách thanh toán" là tiền đặt cọc; orderOf = đang sửa đơn đã lưu).
 * fromOrder: hóa đơn tạo từ đơn đặt hàng ("Tạo hóa đơn") — tiền cọc trừ vào khách cần trả.
 * discountPercent: giảm giá hóa đơn theo % (từ nhóm khách), tính lại khi giỏ hàng đổi; sửa tay → về số tiền.
 * priceBookId/Name: bảng giá đang chọn (null = "Bảng giá chung"); salesChannel: mã kênh bán (mặc định DIRECT).
 * mode DELIVERY = Bán giao hàng (delivery: người nhận, đối tác, phí); expectedDeliveryAt: thời gian giao của đơn đặt hàng.
 * id = UUID gửi lên server (bán mới / phiếu trả: giữ nguyên khi gửi lại → không tạo trùng).
 */
export type DraftInvoice = {
  id: string;
  kind?: "SALE" | "EDIT" | "RETURN" | "ORDER";
  orderOf?: OrderRef;
  fromOrder?: OrderRef;
  discountPercent?: number | null;
  priceBookId: string | null;
  priceBookName?: string | null;
  salesChannel?: string;
  delivery?: DeliveryDraft | null;
  expectedDeliveryAt?: string | null;
  editOf?: { invoiceId: string; code: string; revision: number };
  returnOf?: { invoiceId: string; code: string; lines: ReturnLine[]; fee: number; refund: number | null };
  /** Trả nhanh (không theo hóa đơn): hàng trả nằm ở `lines` (giá trả = đơn giá − giảm giá), phí + tiền trả khách ở đây. */
  quickReturn?: { fee: number; refund: number | null };
  einvoiceBuyer?: EInvoiceBuyer | null;
  extraPayments?: ExtraPayment[];
  label: string;
  mode: "QUICK" | "NORMAL" | "DELIVERY";
  customer: SaleCustomer | null;
  sellerId: string;
  lines: CartLine[];
  discount: number;
  paid: number | null; // null = khách trả đủ (mặc định)
  paymentMethod: "CASH" | "TRANSFER" | "CARD" | "EWALLET";
  note: string;
};

/**
 * Phiếu đã bấm lưu nhưng chưa lên server (mất mạng / lỗi): hóa đơn, phiếu trả hàng, đơn đặt hàng (server bỏ qua bản gửi lại
 * cùng id). kind thiếu = hóa đơn (bản lưu cũ).
 */
export type QueuedInvoice = {
  id: string;
  kind?: "INVOICE" | "RETURN" | "ORDER";
  label?: string; // tên tab lúc lưu (chưa có mã phiếu)
  createdAt: string;
  body: Record<string, unknown>;
  customerName: string;
  total: number;
  status: "pending" | "error";
  error?: string;
};
