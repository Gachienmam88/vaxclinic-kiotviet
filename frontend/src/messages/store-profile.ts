import { createNamespace } from "@/lib/i18n/namespace";
import vi from "./vi/store-profile.json";

/** Hồ sơ cửa hàng: thông tin gian hàng, bảo lưu/đổi tên/chuyển nhượng, HĐĐT, chữ ký số, khung Điều khoản sử dụng. */
export const storeProfileNs = createNamespace("store-profile", vi);
