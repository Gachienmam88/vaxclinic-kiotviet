"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SALE_ROUTE } from "./sale-storage";

/**
 * /sale?new=1 (Hóa đơn → "+ Tạo mới" → Hóa đơn): mở thêm 1 tab hóa đơn trống rồi xóa tham số.
 * Chờ các tab đã lưu trên máy được nạp (ready) để tab mới không bị ghi đè.
 */
export function useSaleNewTabParam(ready: boolean, add: () => void) {
  const params = useSearchParams();
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current || params.get("new") !== "1") return;
    done.current = true;
    add();
    router.replace(SALE_ROUTE);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chạy 1 lần khi tab đã nạp
  }, [ready, params]);
}
