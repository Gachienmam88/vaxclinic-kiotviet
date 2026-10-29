import { api } from "@/lib/api-client";
import { areaFromServer } from "@/features/delivery/delivery-address";
import { toLocalInput } from "@/features/purchases/purchase-line-form";
import type { Invoice } from "@/features/sales/sales-types";
import type { SaleT } from "@/messages/sale";
import { KEYS, load, newId } from "./sale-storage";
import type { CartLine, CatalogProduct, DeliveryDraft, DraftInvoice, EInvoiceBuyer, SaleCustomer } from "./sale-types";

type SavedLine = {
  productId: string; unitId: string; productCode: string; productName: string; unitName: string;
  quantity: number; unitPrice: number; discount: number; note: string | null; taxCode: string | null;
};

/**
 * Dòng hóa đơn / đơn đặt hàng đã lưu → dòng giỏ hàng (đơn vị lấy từ danh mục; hàng đã ngừng bán giữ đơn vị cũ).
 * Giữ đúng giá đã lưu: priceEdited = true để đổi bảng giá không âm thầm tính lại.
 */
export function toCartLines(lines: SavedLine[], catalog: CatalogProduct[]): CartLine[] {
  return lines.map((l) => {
    const p = catalog.find((x) => x.id === l.productId);
    const units = p?.units.length ? p.units
      : [{ id: l.unitId, code: l.productCode, barcode: null, unitName: l.unitName, conversionRate: 1, price: Number(l.unitPrice) }];
    return { key: newId(), productId: l.productId, productName: l.productName, unitId: l.unitId, units,
      quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), discount: Number(l.discount), note: l.note ?? "",
      taxCode: l.taxCode ?? p?.taxCode ?? null, priceEdited: true };
  });
}

/** Nhóm của khách (hóa đơn / đơn không mang nhóm) lấy từ khách đã lưu trên máy → lọc bảng giá theo nhóm. */
export function cachedCustomerGroupId(customerId: string): string | null {
  return load<SaleCustomer[]>(KEYS.customers, []).find((c) => c.id === customerId)?.groupId ?? null;
}

/**
 * Mở 1 hóa đơn đã bán lên màn bán hàng:
 * - "edit": tab Update_HDxxx với đúng giỏ hàng, khách, tiền đã trả → Thanh toán = lưu bản sửa (PUT, kèm revision).
 * - "return": tab "Trả hàng / HDxxx" với từng dòng: đã mua / đã trả / giá → chọn số lượng trả.
 * Cần có mạng (dữ liệu hóa đơn nằm trên server).
 */
export async function draftFromInvoice(invoiceId: string, mode: "edit" | "return", catalog: CatalogProduct[],
                                       sellerId: string, t: SaleT): Promise<DraftInvoice> {
  const inv = await api<Invoice>(`/invoices/${invoiceId}`);
  if (inv.status !== "COMPLETED") throw new Error(t("open.invoiceCancelled"));
  const customer = inv.customerId ? { id: inv.customerId, code: inv.customerCode ?? "", name: inv.customerName, phone: inv.customerPhone,
    groupId: cachedCustomerGroupId(inv.customerId) } : null;
  if (mode === "return") {
    return {
      id: newId(), kind: "RETURN", label: t("open.returnLabel", { code: inv.code }), mode: "QUICK", customer, sellerId, lines: [],
      discount: 0, paid: null, paymentMethod: "CASH", note: "", priceBookId: null,
      returnOf: {
        invoiceId: inv.id, code: inv.code, fee: 0, refund: null,
        lines: inv.lines.map((l) => ({ invoiceLineId: l.id, productCode: l.productCode, productName: l.productName,
          unitName: l.unitName, sold: Number(l.quantity), returned: Number(l.returnedQuantity ?? 0), price: Number(l.price), quantity: 0 })),
      },
    };
  }
  // Hóa đơn từ đơn đặt hàng: tiền cọc đã phân bổ sẵn → "Khách thanh toán" chỉ là phiếu TT{mã HĐ}
  const paid = inv.orderId
    ? inv.payments.filter((p) => p.code === `TT${inv.code}` && p.status === "PAID").reduce((s, p) => s + Number(p.allocated), 0)
    : Number(inv.paid);
  const shipment = inv.shipment && inv.shipment.status !== "CANCELLED" ? inv.shipment : null; // vận đơn đã hủy: tạo lại ở chi tiết HĐ
  return {
    id: inv.id, kind: "EDIT", editOf: { invoiceId: inv.id, code: inv.code, revision: inv.revision },
    label: `Update_${inv.code}`, mode: shipment ? "DELIVERY" : "QUICK", customer, sellerId: inv.sellerId ?? sellerId,
    discount: Number(inv.discount), paid, paymentMethod: (inv.paymentMethod ?? "CASH") as DraftInvoice["paymentMethod"],
    note: inv.note ?? "", lines: toCartLines(inv.lines, catalog), priceBookId: inv.priceBookId ?? null,
    priceBookName: inv.priceBookName, salesChannel: inv.salesChannel ?? "DIRECT", delivery: deliveryDraftOf(shipment),
    einvoiceBuyer: (inv as Invoice & { einvoiceBuyer?: EInvoiceBuyer | null }).einvoiceBuyer ?? null,
  };
}

/** Vận đơn đã lưu → khung giao hàng (sửa hóa đơn trước khi lấy hàng). */
function deliveryDraftOf(s: Invoice["shipment"]): DeliveryDraft | null {
  return s ? { partnerId: s.partnerId, receiverName: s.receiverName, receiverPhone: s.receiverPhone, receiverAddress: s.receiverAddress,
    ...areaFromServer(s), weightGram: s.weightGram, shippingFee: Number(s.shippingFee), feePayer: s.feePayer, note: s.note ?? "",
    serviceType: s.serviceType ?? "STANDARD", waybillCode: s.waybillCode ?? "",
    expectedDeliveryAt: s.expectedDeliveryAt ? toLocalInput(s.expectedDeliveryAt) : "", packageCount: s.packageCount ?? 1,
    lengthCm: s.lengthCm ?? null, widthCm: s.widthCm ?? null, heightCm: s.heightCm ?? null, codEnabled: s.codEnabled !== false,
    status: s.status === "PICKING" ? "PICKING" : "PENDING" } : null;
}

/**
 * "Sao chép" ở chi tiết hóa đơn (/sale?copy=<id>): tab bán MỚI điền sẵn khách, hàng (giá đã bán), giảm giá, kênh bán, bảng giá,
 * ghi chú của hóa đơn cũ (kể cả hóa đơn đã hủy). Không mang theo tiền đã trả / vận đơn → khách trả = khách cần trả.
 */
export async function draftCopyOfInvoice(invoiceId: string, catalog: CatalogProduct[], sellerId: string, t: SaleT): Promise<DraftInvoice> {
  const inv = await api<Invoice>(`/invoices/${invoiceId}`);
  const customer = inv.customerId ? { id: inv.customerId, code: inv.customerCode ?? "", name: inv.customerName, phone: inv.customerPhone,
    groupId: cachedCustomerGroupId(inv.customerId) } : null;
  return {
    id: newId(), kind: "SALE", label: t("open.copyLabel", { code: inv.code }), mode: "QUICK", customer, sellerId, lines: toCartLines(inv.lines, catalog),
    discount: Number(inv.discount), paid: null, paymentMethod: "CASH", note: inv.note ?? "", priceBookId: inv.priceBookId ?? null,
    priceBookName: inv.priceBookName, salesChannel: inv.salesChannel ?? "DIRECT",
  };
}
