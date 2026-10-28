import { createNamespace } from "@/lib/i18n/namespace";
import vi from "./vi/common.json";

/** Chuỗi dùng chung toàn app: nút (Lưu/Hủy…), trạng thái, lịch, trạng thái rỗng, ô chọn, địa chỉ, phân trang. */
export const commonNs = createNamespace("common", vi);
