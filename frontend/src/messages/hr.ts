import { createNamespace } from "@/lib/i18n/namespace";
import type { TFunction } from "@/lib/i18n";
import vi from "./vi/hr.json";

/** Chuỗi module Nhân viên: danh sách, lịch làm việc, bảng chấm công, bảng lương, hoa hồng, thiết lập, chấm công điện thoại. */
export const hrNs = createNamespace("hr", vi);

/** Hàm dịch của namespace hr — truyền cho helper không phải React (nhãn tuần, CSV...). */
export type HrT = TFunction<typeof vi>;
