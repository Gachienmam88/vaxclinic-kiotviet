import { createNamespace } from "@/lib/i18n/namespace";
import vi from "./vi/customers.json";

/** Chuỗi khu Khách hàng (app/(admin)/customers/** + features/sales/customer-*, debt-dialogs). */
export const customersNs = createNamespace("customers", vi);
