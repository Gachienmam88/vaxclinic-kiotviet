import { createNamespace } from "@/lib/i18n/namespace";
import vi from "./vi/print.json";

/** Giao diện quanh việc in (sửa mẫu in, xem trước, nhãn trường). Nội dung chứng từ in luôn tiếng Việt. */
export const printNs = createNamespace("print", vi);
