"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SALE_ROUTE } from "./sale-storage";

/**
 * /sale?new=1 (Hóa đơn → "+ Tạo mới" → Hóa đơn) mở thêm 1 tab hóa đơn trống; /sale?newOrder=1 (Đặt hàng → "+ Đặt hàng")
 * mở tab đặt hàng trống. Xong thì xóa tham số.
 * Chờ các tab đã lưu trên máy được nạp (ready) để tab mới không bị ghi đè.
 */
export function useSaleNewTabParam(ready: boolean, add: (kind?: "ORDER") => void) {
  const params = useSearchParams();
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    const order = params.get("newOrder") === "1";
    if (!ready || done.current || (params.get("new") !== "1" && !order)) return;
    done.current = true;
    add(order ? "ORDER" : undefined);
    router.replace(SALE_ROUTE);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy 1 lần khi tab đã nạp
  }, [ready, params]);
}
