"use client";

import { useEffect } from "react";
import { syncAccentForUser } from "@/lib/accent-theme";
import { useCurrentUser } from "@/lib/use-current-user";

/**
 * Áp màu chủ đề của người dùng đang đăng nhập (đặt ở thanh trên phần quản lý và màn bán hàng).
 * Cần khi vào từ trang đăng nhập bằng điều hướng phía client — script trong <head> chỉ chạy ở lần tải trang.
 */
export function AccentThemeSync() {
  const { data: me } = useCurrentUser();
  const userId = me?.user.id;
  useEffect(() => { if (userId) syncAccentForUser(userId); }, [userId]);
  return null;
}
