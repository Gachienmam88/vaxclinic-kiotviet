import { createNamespace } from "@/lib/i18n/namespace";
import vi from "./vi/orders.json";

/** Chuỗi khu Đặt hàng (features/orders/**, app/(admin)/orders/**). */
export const ordersNs = createNamespace("orders", vi);
