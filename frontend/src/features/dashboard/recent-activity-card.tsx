"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { DocCodeLink } from "@/components/ui/doc-code-link";
import { useT } from "@/lib/i18n";
import { renderRichText } from "@/lib/i18n/render-rich-text";
import { commonNs } from "@/messages/common";
import { dashboardNs } from "@/messages/dashboard";
import { timeAgo } from "./dashboard-date-utils";
import type { AuditLog } from "./dashboard-queries";

/** "Hoạt động gần đây": 10 thao tác mới nhất từ Lịch sử thao tác (chỉ người có quyền user.manage). */
export function RecentActivityCard({ items, isLoading }: { items: AuditLog[]; isLoading: boolean }) {
  const t = useT(dashboardNs);
  const tc = useT(commonNs);
  return (
    <section className="rounded-lg bg-background px-3.5 py-4" aria-labelledby="activity-title">
      <div className="mb-3 flex items-center">
        <h2 id="activity-title" className="flex-1 text-[13px] font-semibold">{t("activity.title")}</h2>
        <Link href="/settings/audit-logs" className="text-xs text-primary hover:underline">{t("activity.viewAll")}</Link>
      </div>
      {isLoading && <p className="py-6 text-center text-[13px] text-muted-foreground">{tc("status.loading")}</p>}
      {!isLoading && !items.length && <p className="py-6 text-center text-[13px] text-muted-foreground">{t("activity.empty")}</p>}
      <ol className="space-y-4">
        {items.map((l) => (
          <li key={l.id} className="flex gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#eef0f3]" aria-hidden>
              <FileText className="size-3.5 text-foreground/60" />
            </span>
            <div className="min-w-0 text-[13px] leading-[18px]">
              {/* Hành động / chức năng là dữ liệu nhật ký từ server (tiếng Việt) — chỉ dịch khung câu. */}
              <p>{renderRichText(t("activity.line"), {
                user: <span className="text-primary">{l.userName ?? t("activity.system")}</span>,
                action: <span className="text-primary">{l.action.toLowerCase()} {l.feature.toLowerCase()}</span>,
                doc: l.docCode ? <> <DocCodeLink code={l.docCode} className="font-semibold" /></> : null,
              })}</p>
              {l.detail && <p className="line-clamp-2 text-xs text-muted-foreground">{l.detail}</p>}
              <time dateTime={l.occurredAt} className="text-[11px] text-muted-foreground" title={new Date(l.occurredAt).toLocaleString("vi-VN")}>
                {timeAgo(l.occurredAt, t)}
              </time>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
