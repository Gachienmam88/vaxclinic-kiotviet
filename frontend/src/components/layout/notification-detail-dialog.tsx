"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatInboxTime, inboxItemHref, type InboxItem } from "./notification-queries";

/** Chi tiết thông báo (thông báo nội bộ, hoặc cảnh báo không có trang đích): tiêu đề, người gửi + thời gian, nội dung. */
export function NotificationDetailDialog({ item, onOpenChange }: {
  item: InboxItem | null; onOpenChange: (open: boolean) => void;
}) {
  const href = item ? inboxItemHref(item) : null;
  const external = href ? /^https?:\/\//i.test(href) : false;
  return (
    <Dialog open={item != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6 text-base leading-6">{item.title}</DialogTitle>
              <p className="text-xs text-muted-foreground">
                {formatInboxTime(item.createdAt)}
                {item.createdByName && <> · {item.createdByName}</>}
                {item.branchName && <> · {item.branchName}</>}
              </p>
            </DialogHeader>
            {item.body && <p className="max-h-[50vh] overflow-y-auto text-[13px] leading-5 whitespace-pre-wrap">{item.body}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
              {href && (
                <Button render={external
                  ? <a href={href} target="_blank" rel="noopener noreferrer" />
                  : <Link href={href} onClick={() => onOpenChange(false)} />}>
                  Xem chi tiết
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
