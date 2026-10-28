import { createNamespace } from "@/lib/i18n/namespace";
import vi from "./vi/cashbook.json";

/** Chuỗi khu Sổ quỹ (app/(admin)/cashbook/** + features/sales/cash-voucher-*). */
export const cashbookNs = createNamespace("cashbook", vi);
