"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-current-user";
import { commonNs } from "@/messages/common";

/**
 * Quyền xem từng khu màn hình — cùng quyền với menu (app-header-nav-menu). Thiết lập / Hồ sơ cửa hàng tự kiểm quyền
 * ở trang của chúng nên không có ở đây. Tiền tố dài khớp trước.
 */
const ROUTE_PERMS: [prefix: string, perm: string][] = [
  ["/products", "catalog.view"], ["/inventory", "inventory.view"], ["/purchases", "inventory.view"],
  ["/invoices", "sales.perform"], ["/orders", "sales.perform"], ["/returns", "sales.perform"], ["/delivery", "sales.perform"],
  ["/customers", "patient.view"], ["/employees", "hr.manage"], ["/cashbook", "cashbook.manage"],
  ["/reports", "report.view"], ["/accounting", "report.view"],
];

const permOf = (pathname: string) =>
  ROUTE_PERMS.find(([p]) => pathname === p || pathname.startsWith(p + "/"))?.[1];

/**
 * Như KiotViet: mở trang không có quyền (gõ URL / link sâu) → về Tổng quan + toast "Bạn không có quyền xem thông tin này."
 * Chờ biết quyền rồi mới render trang cần quyền để trang không gọi API trả 403. Không tải được /auth/me → để backend chặn.
 */
export function RoutePermissionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const tc = useT(commonNs);
  const { data: me, isError, can } = useCurrentUser();
  const perm = permOf(pathname);
  const denied = !!perm && !!me && !can(perm);

  useEffect(() => {
    if (!denied) return;
    toast.error(tc("errors.noViewPermission"), { id: "no-view-permission" });
    router.replace("/");
  }, [denied, router, tc]);

  if (perm && !me && !isError) return null;
  return denied ? null : <>{children}</>;
}
