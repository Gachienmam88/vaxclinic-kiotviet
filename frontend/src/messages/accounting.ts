import { createNamespace } from "@/lib/i18n/namespace";
import vi from "./vi/accounting.json";

/**
 * Thuế & Kế toán hộ kinh doanh: trang /accounting (khung quanh các sổ, tờ khai) + thẻ hồ sơ thuế / ngành nghề ở
 * Thiết lập → Thuế. Nội dung sổ kế toán (S1a/S2a/S2d/S2e-HKD) và CSV kê khai giữ tiếng Việt, không nằm ở đây.
 */
export const accountingNs = createNamespace("accounting", vi);
