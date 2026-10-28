"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PauseCircle } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-current-user";
import { useStoreStatus } from "./store-profile-queries";
import { TermsOfUseView } from "./terms-of-use-view";
import { useAcceptTerms, useTermsStatus } from "./terms-queries";

/** Trang không cần đăng nhập (hoặc tự xử lý phiên): không kiểm tra bảo lưu / điều khoản. */
const PUBLIC_PATHS = ["/login", "/welcome", "/cham-cong"];

async function logout() {
  await fetch("/api/session/logout", { method: "POST" });
  window.location.href = "/login";
}

/** Màn hình phủ toàn trang khi gian hàng bảo lưu (mọi API trừ tài khoản / hồ sơ cửa hàng trả 423). */
function PausedNotice({ reopenOn, isOwner }: { reopenOn: string | null; isOwner: boolean }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-muted p-4">
      <div className="w-full max-w-md space-y-3 rounded-xl bg-background p-6 text-center shadow-lg">
        <PauseCircle className="mx-auto size-12 text-orange-500" />
        <h1 className="text-lg font-bold">Gian hàng đang bảo lưu</h1>
        <p className="text-[13px] text-muted-foreground">
          Gian hàng tạm khóa, dữ liệu được giữ nguyên. Gian hàng tự động mở lại ngày {formatDate(reopenOn)}.
        </p>
        <p className="text-[13px] text-muted-foreground">
          {isOwner ? "Bạn là chủ gian hàng, có thể mở lại trước hạn." : "Liên hệ chủ gian hàng nếu cần mở lại trước hạn."}
        </p>
        <div className="flex justify-center gap-2 pt-1">
          <button type="button" onClick={() => void logout()} className="h-9 rounded-md border border-border px-4 text-[13px] font-semibold hover:bg-muted">Đăng xuất</button>
          {isOwner && <Link href="/store-profile" className="flex h-9 items-center rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90">Mở lại gian hàng</Link>}
        </div>
      </div>
    </div>
  );
}

/** Hộp bắt buộc đồng ý Điều khoản sử dụng phiên bản mới trước khi dùng tiếp. */
function TermsPrompt() {
  const [agreed, setAgreed] = useState(false);
  const accept = useAcceptTerms();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-label="Điều khoản sử dụng" className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl bg-background shadow-xl">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5"><TermsOfUseView /></div>
        <div className="flex items-center gap-3 border-t border-border px-6 py-3 text-[13px]">
          <label className="flex flex-1 items-center gap-2">
            <input type="checkbox" className="size-4 accent-primary" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            Tôi đã đọc và đồng ý với Điều khoản sử dụng
          </label>
          <button type="button" onClick={() => void logout()} className="h-9 rounded-md border border-border px-4 font-semibold hover:bg-muted">Đăng xuất</button>
          <button type="button" disabled={!agreed || accept.isPending} onClick={() => accept.mutate()}
            className="h-9 rounded-md bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">Tôi đồng ý</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Lớp kiểm tra sau đăng nhập (gắn ở Providers nên phủ cả trang quản lý lẫn màn bán hàng):
 * 1. gian hàng bảo lưu → thông báo toàn trang (trừ khu Hồ sơ cửa hàng để chủ gian hàng mở lại);
 * 2. chưa đồng ý Điều khoản phiên bản hiện hành → bắt buộc đồng ý.
 */
export function StoreAccessGate() {
  const pathname = usePathname();
  const active = !PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const status = useStoreStatus();
  const terms = useTermsStatus(active);
  const { data: me } = useCurrentUser();
  if (!active) return null;
  if (status.data?.paused && !pathname.startsWith("/store-profile")) {
    return <PausedNotice reopenOn={status.data.reopenOn} isOwner={!!me?.storeOwner} />;
  }
  if (terms.data && !terms.data.acceptedAt) return <TermsPrompt />;
  return null;
}
