import { createNamespace } from "@/lib/i18n/namespace";
import vi from "./vi/delivery.json";

/** Chuỗi khu Giao hàng (features/delivery/**, app/(admin)/delivery/**). */
export const deliveryNs = createNamespace("delivery", vi);
