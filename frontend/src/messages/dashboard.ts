import { createNamespace } from "@/lib/i18n/namespace";
import vi from "./vi/dashboard.json";

/** Chuỗi trang Tổng quan (app/(admin)/page.tsx + features/dashboard/**). */
export const dashboardNs = createNamespace("dashboard", vi);
