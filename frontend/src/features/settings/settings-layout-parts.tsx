"use client";

import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { settingsNs } from "@/messages/settings";

/** Bảng trong thẻ thiết lập (Người dùng, Chi nhánh, Lịch sử thao tác...): header nền xám 12px, dòng 13px. */
export const SETTINGS_TABLE = {
  table: "w-full text-[13px]",
  head: "bg-[#f0f2f5] text-left text-xs font-semibold text-foreground [&_th]:h-[34px] [&_th]:px-2 [&_th]:font-semibold",
  row: "border-b border-[#eceef1] align-top [&_td]:px-2 [&_td]:py-3",
  empty: "py-8 text-center text-muted-foreground",
};

/** Tab gạch chân kiểu KiotViet (chữ 13px, tab đang chọn chữ + gạch xanh) — truyền vào TabsList/TabsTrigger. */
export const SETTINGS_TABS = {
  list: "h-11 w-full justify-start gap-4 border-b border-[#eceef1] px-5",
  trigger: "flex-none px-0.5 text-[13px] font-normal text-foreground data-active:font-medium data-active:text-primary after:!bg-primary",
};

/** Nhãn trạng thái nhỏ: xanh nhạt = đang hoạt động, xám = ngừng. */
export function StatusPill({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("inline-block rounded px-1.5 py-0.5 text-[11px] leading-4 whitespace-nowrap",
      on ? "bg-primary-tint text-primary" : "bg-muted text-muted-foreground")}>{children}</span>
  );
}

/** Thẻ nhóm thiết lập (VD "Quản lý đơn hàng"); id dùng cho mục lục bên phải. */
export function SettingsCard({ id, title, description, action, children, className }: {
  id?: string; title: string; description?: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode; className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-28 rounded-lg bg-background", className)}>
      <div className="flex min-h-12 items-center gap-3 border-b border-[#eceef1] px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] leading-5 font-semibold">{title}</h2>
          {description && <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Một dòng thiết lập: tiêu đề + mô tả bên trái, nút gạt / giá trị bên phải, phần mở rộng bên dưới. */
export function SettingRow({ title, description, control, children }: {
  title: string; description?: React.ReactNode; control?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-[#eceef1] px-5 py-3.5 last:border-0">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-5 font-medium">{title}</p>
          {description && <div className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{description}</div>}
        </div>
        {control}
      </div>
      {children}
    </div>
  );
}

/** Ô "Gợi ý" bên phải (màn dạng bảng: Người dùng, Chi nhánh, Lịch sử thao tác). */
export function SettingsHint({ children }: { children: React.ReactNode }) {
  const t = useT(settingsNs);
  return (
    <div className="rounded-lg bg-background p-3 text-xs leading-[18px]">
      <p className="mb-2 flex items-center gap-1.5 font-medium text-primary"><Lightbulb className="size-3.5" /> {t("common.hint")}</p>
      <div className="text-foreground/80">{children}</div>
    </div>
  );
}

/** Theo dõi mục đang xem để tô sáng mục lục (thanh xanh 2px bên trái). */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  const key = ids.join("|");
  useEffect(() => {
    const els = key.split("|").map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: "-110px 0px -55% 0px" });
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, [key]);
  return active;
}

/** Trang thiết lập: nội dung giữa + cột phải 160px (mục lục và/hoặc ô gợi ý), giống KiotViet. */
export function SettingsPage({ toc = [], hint, children }: {
  toc?: { id: string; label: string }[]; hint?: React.ReactNode; children: React.ReactNode;
}) {
  const active = useActiveSection(toc.map((t) => t.id));
  return (
    <div className="flex items-start gap-2.5">
      <div className="min-w-0 flex-1 space-y-3">{children}</div>
      {(toc.length > 0 || hint) && (
        <aside className="sticky top-28 hidden w-40 shrink-0 space-y-2.5 xl:block">
          {toc.length > 0 && (
            <nav className="rounded-lg bg-background py-2 text-xs">
              {toc.map((t) => (
                <a key={t.id} href={`#${t.id}`} aria-current={active === t.id ? "location" : undefined}
                  className={cn("block border-l-2 px-3 py-[5px] leading-4 hover:text-primary",
                    active === t.id ? "border-primary text-primary" : "border-transparent text-foreground/80")}>
                  {t.label}
                </a>
              ))}
            </nav>
          )}
          {hint && <SettingsHint>{hint}</SettingsHint>}
        </aside>
      )}
    </div>
  );
}
