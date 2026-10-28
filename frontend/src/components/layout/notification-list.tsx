"use client";

import { useEffect, useRef } from "react";
import { Bell, CloudOff, Megaphone, TriangleAlert } from "lucide-react";
import { ListEmptyState } from "@/components/ui/list-empty-state";
import { cn } from "@/lib/utils";
import { formatInboxTime, type InboxItem } from "./notification-queries";

/** Ô vuông bo góc xanh nhạt chứa icon (40px) — Cảnh báo: tam giác, Cập nhật: loa, còn lại chuông. */
function RowIcon({ icon: Icon }: { icon: typeof Bell }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#e8f1fe] text-[#4b5563]">
      <Icon className="size-[18px]" strokeWidth={1.7} />
    </span>
  );
}

function Row({ icon, title, sub, unread, onClick }: {
  icon: typeof Bell; title: string; sub: React.ReactNode; unread: boolean; onClick: () => void;
}) {
  return (
    <li>
      <button type="button" onClick={onClick}
        className="flex w-full items-center gap-3 border-b border-[#eceef1] px-4 py-3 text-left hover:bg-[#f0f2f5]">
        <RowIcon icon={icon} />
        <span className="min-w-0 flex-1">
          <span className={cn("line-clamp-2 text-[13px] leading-[18px] text-foreground", unread && "font-medium")}>{title}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{sub}</span>
        </span>
        <span aria-label={unread ? "Chưa đọc" : undefined}
          className={cn("size-2 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")} />
      </button>
    </li>
  );
}

/**
 * Danh sách trong panel Hộp thư đến. `offlineCount` > 0 → dòng cảnh báo cục bộ "phiếu chưa đồng bộ" ở đầu
 * (chỉ tab Tất cả / Cảnh báo). Cuộn tới cuối → tải thêm trang.
 */
export function NotificationList({ items, loading, offlineCount, hasMore, onLoadMore, onOpen, onOpenOffline }: {
  items: InboxItem[]; loading: boolean; offlineCount: number; hasMore: boolean;
  onLoadMore: () => void; onOpen: (item: InboxItem) => void; onOpenOffline: () => void;
}) {
  const sentinel = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const obs = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) onLoadMore(); });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, onLoadMore]);

  if (loading) return <p className="py-10 text-center text-[13px] text-muted-foreground">Đang tải...</p>;
  if (!items.length && !offlineCount) return <ListEmptyState what="thông báo" period="" compact />;

  return (
    <ul>
      {offlineCount > 0 && (
        <Row icon={CloudOff} unread onClick={onOpenOffline}
          title={`Có ${offlineCount} phiếu bán offline trên máy này chưa đồng bộ lên hệ thống`}
          sub="Mở màn hình Bán hàng khi có mạng để đồng bộ" />
      )}
      {items.map((n) => (
        <Row key={n.id} icon={n.category === "UPDATE" ? Megaphone : n.type === "SEPAY_RECEIVED" ? Bell : TriangleAlert}
          title={n.title} unread={!n.read} onClick={() => onOpen(n)}
          sub={<>{formatInboxTime(n.createdAt)}{n.branchName && <> · {n.branchName}</>}</>} />
      ))}
      {hasMore && <li ref={sentinel} className="py-3 text-center text-xs text-muted-foreground">Đang tải thêm...</li>}
    </ul>
  );
}
