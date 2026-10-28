"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n";
import { commonNs } from "@/messages/common";
import { settingsNs } from "@/messages/settings";
import { useSaveAnnouncement, type Announcement } from "./notification-settings-queries";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; announcement?: Announcement };

/**
 * Viết / sửa thông báo nội bộ gửi tới mọi người dùng (tab "Cập nhật" của Hộp thư đến).
 * Đường dẫn: trang trong ứng dụng ("/products?code=SP000001") hoặc địa chỉ http(s) bên ngoài.
 */
export function AnnouncementFormDialog({ open, onOpenChange, announcement }: Props) {
  const t = useT(settingsNs);
  const tc = useT(commonNs);
  const [form, setForm] = useState({
    title: announcement?.title ?? "", body: announcement?.body ?? "", link: announcement?.link ?? "",
  });
  const save = useSaveAnnouncement(announcement?.id, () => onOpenChange(false));
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{announcement ? t("announcementForm.editTitle") : t("announcementForm.createTitle")}</DialogTitle>
        </DialogHeader>
        <form id="announcement-form" className="grid gap-3"
          onSubmit={(e) => { e.preventDefault(); save.mutate({ ...form, title: form.title.trim() }); }}>
          <div className="grid gap-1.5">
            <Label htmlFor="ann-title">{t("announcementForm.title")}</Label>
            <Input id="ann-title" required maxLength={300} value={form.title} onChange={set("title")}
              placeholder={t("announcementForm.titlePlaceholder")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ann-body">{t("announcementForm.body")}</Label>
            <Textarea id="ann-body" rows={6} maxLength={5000} value={form.body} onChange={set("body")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ann-link">{t("announcementForm.link")}</Label>
            <Input id="ann-link" maxLength={500} value={form.link} onChange={set("link")}
              placeholder={t("announcementForm.linkPlaceholder")} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("actions.skip")}</Button>
          <Button type="submit" form="announcement-form" disabled={save.isPending || !form.title.trim()}>
            {announcement ? tc("actions.save") : t("announcementForm.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
