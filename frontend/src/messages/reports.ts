import { createNamespace } from "@/lib/i18n/namespace";
import type { TFunction } from "@/lib/i18n";
import vi from "./vi/reports.json";

/** Chuỗi khu Báo cáo (app/(admin)/reports/** + features/reports/**). */
export const reportsNs = createNamespace("reports", vi);
/** Hàm dịch của namespace reports — cho helper ngoài React (cột bảng, dòng tổng, khoảng ngày). */
export type ReportsT = TFunction<typeof vi>;
