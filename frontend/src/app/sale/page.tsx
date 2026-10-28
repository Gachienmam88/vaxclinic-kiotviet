import { Suspense } from "react";
import { SaleScreen } from "@/features/sale/sale-screen";

/** Màn bán hàng toàn màn hình — nằm ngoài layout quản lý (không có menu xanh). ?edit= / ?return= mở hóa đơn. */
export default function SalePage() {
  return <Suspense><SaleScreen /></Suspense>;
}
