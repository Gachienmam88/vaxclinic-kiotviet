import { createNamespace } from "@/lib/i18n/namespace";
import type { TFunction } from "@/lib/i18n";
import vi from "./vi/sale.json";

/** Chuỗi màn bán hàng /sale (features/sale/**): thanh xanh, giỏ hàng, thanh toán, trả hàng, hộp thoại, phím tắt, thiết lập. */
export const saleNs = createNamespace("sale", vi);

/** Hàm dịch của namespace sale — truyền vào helper không phải React (toast, kiểm tra trước khi thanh toán...). */
export type SaleT = TFunction<typeof vi>;
