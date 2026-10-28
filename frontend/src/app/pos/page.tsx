import { Suspense } from "react";
import { PosScreen } from "@/features/pos/pos-screen";

/** Màn bán hàng toàn màn hình — nằm ngoài layout quản lý (không có menu xanh). ?edit= / ?return= mở hóa đơn. */
export default function PosPage() {
  return <Suspense><PosScreen /></Suspense>;
}
