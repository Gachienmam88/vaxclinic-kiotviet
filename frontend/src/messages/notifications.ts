import { createNamespace } from "@/lib/i18n/namespace";
import vi from "./vi/notifications.json";

/** Chuông Hộp thư đến (panel, tab, dòng phiếu offline). Nội dung thông báo do server tạo giữ nguyên (dữ liệu). */
export const notificationsNs = createNamespace("notifications", vi);
