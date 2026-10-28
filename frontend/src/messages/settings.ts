import { createNamespace } from "@/lib/i18n/namespace";
import vi from "./vi/settings.json";

/** Chuỗi khu Thiết lập (app/(admin)/settings/** + features/settings/**). */
export const settingsNs = createNamespace("settings", vi);
