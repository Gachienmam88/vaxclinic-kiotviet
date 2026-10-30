import { createNamespace } from "@/lib/i18n/namespace";
import vi from "./vi/input-invoices.json";

/** Hóa đơn đầu vào: danh sách, đồng bộ cổng thuế, lập phiếu (phiếu nhập / phiếu chi), xác nhận dữ liệu, chi tiết HĐĐT. */
export const inputInvoicesNs = createNamespace("input-invoices", vi);
