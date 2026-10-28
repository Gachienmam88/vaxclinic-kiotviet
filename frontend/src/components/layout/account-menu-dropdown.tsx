"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, LogOut, Store, UserRound } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TwoFactorDialog } from "@/features/auth/two-factor-dialog";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";

const ITEM = "h-9 gap-2.5 px-3 text-[13px]";

/**
 * Menu tài khoản (ảnh 176): avatar + tên đăng nhập + trạng thái xác thực 2 lớp (bấm để bật / quản lý), "Hồ sơ cửa hàng",
 * các mục bổ sung, "Đăng xuất".
 * extraItems: chỗ chèn các mục khác giữa "Hồ sơ cửa hàng" và "Đăng xuất" (VD chọn ngôn ngữ, màu giao diện) —
 * truyền các <DropdownMenuItem> / submenu đã dựng sẵn.
 */
export function AccountMenuDropdown({ extraItems }: { extraItems?: ReactNode }) {
  const { data: me, can } = useCurrentUser();
  const [twoFactor, setTwoFactor] = useState(false);
  const enabled = !!me?.twoFactorEnabled;
  const showProfile = !!me?.storeOwner || can("settings.manage");

  async function logout() {
    await fetch("/api/session/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20"
          aria-label="Tài khoản" title={me?.user.fullName}>
          <UserRound className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[255px] p-0">
          <DropdownMenuGroup>
            <DropdownMenuItem className="gap-2.5 rounded-none px-3 py-3" onClick={() => setTwoFactor(true)}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="size-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{me?.user.username}</span>
                <span className={cn("block text-[11px]", enabled ? "text-green-600" : "text-destructive")}>
                  {enabled ? "Đã bật xác thực 2 lớp" : "Chưa bật xác thực 2 lớp"}
                </span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator className="my-0" />
          {showProfile && (
            <DropdownMenuItem className={ITEM} render={<Link href="/store-profile" />}>
              <Store className="size-4" /> <span className="flex-1">Hồ sơ cửa hàng</span> <ChevronRight className="size-4 text-muted-foreground" />
            </DropdownMenuItem>
          )}
          {extraItems}
          <DropdownMenuSeparator className="my-0" />
          <DropdownMenuItem className={cn(ITEM, "text-destructive focus:text-destructive")} onClick={() => void logout()}>
            <LogOut className="size-4" /> Đăng xuất
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {twoFactor && <TwoFactorDialog enabled={enabled} onClose={() => setTwoFactor(false)} />}
    </>
  );
}
