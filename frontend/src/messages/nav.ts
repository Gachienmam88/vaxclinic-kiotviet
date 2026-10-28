import { createNamespace } from "@/lib/i18n/namespace";
import vi from "./vi/nav.json";

/** Khung app: menu xanh + bảng xổ, header (Thiết lập, Tài khoản), menu tài khoản (Chủ đề, Ngôn ngữ). */
export const navNs = createNamespace("nav", vi);
