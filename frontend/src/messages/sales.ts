import { createNamespace } from "@/lib/i18n/namespace";
import vi from "./vi/sales.json";

/** Chuỗi khu Hóa đơn / Trả hàng (features/sales/** phần hóa đơn, app/(admin)/invoices|returns) + nhãn dùng chung của bán hàng. */
export const salesNs = createNamespace("sales", vi);
