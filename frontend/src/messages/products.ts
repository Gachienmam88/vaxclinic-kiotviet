import { createNamespace } from "@/lib/i18n/namespace";
import vi from "./vi/products.json";

/** Hàng hóa: danh sách, form tạo/sửa, chi tiết (thẻ kho, tồn, lô/HSD), thiết lập giá (bảng giá). */
export const productsNs = createNamespace("products", vi);
