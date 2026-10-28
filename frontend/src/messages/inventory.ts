import { createNamespace } from "@/lib/i18n/namespace";
import vi from "./vi/inventory.json";

/** Kho: kiểm kho, xuất hủy, xuất dùng nội bộ (danh sách, chi tiết, màn soạn phiếu, xuất CSV). */
export const inventoryNs = createNamespace("inventory", vi);
