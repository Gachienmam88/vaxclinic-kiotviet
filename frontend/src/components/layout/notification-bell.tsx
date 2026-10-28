"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { useT } from "@/lib/i18n";
import { zoomAwarePositioning } from "@/lib/zoom-aware-floating-anchor";
import { cn } from "@/lib/utils";
import { notificationsNs } from "@/messages/notifications";
import { NotificationDetailDialog } from "./notification-detail-dialog";
import { NotificationList } from "./notification-list";
import {
  inboxItemHref, useInbox, useMarkAllRead, useMarkRead, useUnreadCount, type InboxItem, type InboxTab,
} from "./notification-queries";
import { useOfflineUnsyncedCount } from "./use-offline-unsynced-count";

/** Nhãn tab: notifications.tabs.<id>. */
const TABS: InboxTab[] = ["all", "alert", "update"];

/**
 * Chuông "Hộp thư đến" trên thanh trên cùng (bên trái nút Thiết lập), theo KiotViet: chấm đỏ số chưa đọc, panel 420px
 * gồm tiêu đề + "Đánh dấu đã đọc tất cả", tab gạch chân, danh sách cuộn. Bấm dòng → đánh dấu đã đọc rồi mở trang
 * liên quan; thông báo nội bộ / cảnh báo không có trang đích → mở hộp thoại chi tiết.
 */
export function NotificationBell() {
  const router = useRouter();
  const t = useT(notificationsNs);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<InboxTab>("all");
  const [detail, setDetail] = useState<InboxItem | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const { data: unread } = useUnreadCount();
  const offline = useOfflineUnsyncedCount();
  const inbox = useInbox(tab, open);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  const items = useMemo(() => inbox.data?.pages.flatMap((p) => p.items) ?? [], [inbox.data]);
  const badge = (unread?.count ?? 0) + offline;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = inbox;
  const loadMore = useCallback(() => { if (hasNextPage && !isFetchingNextPage) void fetchNextPage(); }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const positioning = useMemo(() => (open ? zoomAwarePositioning(() => trigger.current) : undefined), [open]);

  function openItem(item: InboxItem) {
    if (!item.read) markRead.mutate(item.id);
    const href = inboxItemHref(item);
    setOpen(false);
    if (item.category === "UPDATE" || !href) setDetail(item);
    else if (/^https?:\/\//i.test(href)) window.open(href, "_blank", "noopener,noreferrer");
    else router.push(href);
  }

  return (
    <>
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger ref={trigger} aria-label={t("title")} title={t("title")}
          className={cn("relative flex size-7 items-center justify-center rounded-full hover:bg-muted", open && "bg-muted")}>
          <Bell className="size-[18px]" />
          {badge > 0 && (
            <span className="absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e5372c] px-1 text-[10px] leading-none font-semibold text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner className="isolate z-50 outline-none" {...positioning} side="bottom" align="end" sideOffset={6}>
            <PopoverPrimitive.Popup aria-label={t("title")}
              className="flex max-h-[min(580px,calc(100vh-80px))] w-[420px] flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-[0_4px_24px_rgba(0,0,0,0.16)] outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0">
              <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
                <h2 className="flex-1 text-lg font-semibold">{t("title")}</h2>
                <button type="button" disabled={!unread?.count || markAll.isPending} onClick={() => markAll.mutate()}
                  className="text-xs text-primary hover:underline disabled:pointer-events-none disabled:text-muted-foreground">
                  {t("markAllRead")}
                </button>
              </div>
              <div role="tablist" className="flex gap-6 border-b border-[#eceef1] px-4">
                {TABS.map((id) => (
                  <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                    className={cn("relative h-9 text-[13px]",
                      tab === id ? "font-medium text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                        : "text-foreground hover:text-primary")}>
                    {t(`tabs.${id}`)}
                  </button>
                ))}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <NotificationList items={items} loading={inbox.isPending} offlineCount={tab === "update" ? 0 : offline}
                  hasMore={!!hasNextPage} onLoadMore={loadMore} onOpen={openItem}
                  onOpenOffline={() => { setOpen(false); router.push("/pos"); }} />
              </div>
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
      <NotificationDetailDialog item={detail} onOpenChange={(o) => { if (!o) setDetail(null); }} />
    </>
  );
}
