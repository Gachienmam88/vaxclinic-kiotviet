import { createNamespace } from "@/lib/i18n/namespace";
import vi from "./vi/purchases.json";

/** Mua hàng: nhập hàng, trả hàng nhập, nhà cung cấp (công nợ NCC), hóa đơn đầu vào + trạng thái HĐĐT. */
export const purchasesNs = createNamespace("purchases", vi);
