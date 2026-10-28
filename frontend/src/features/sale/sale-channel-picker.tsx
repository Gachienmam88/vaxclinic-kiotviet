"use client";

import { Check, ChevronDown, Globe, MessageCircle, PersonStanding, Phone, Store } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/lib/i18n";
import { saleNs } from "@/messages/sale";
import type { SaleLookups } from "./use-sale-lookups";

/** Icon theo kênh bán (Bán trực tiếp = người đi bộ như KiotViet). */
function ChannelIcon({ code, className }: { code: string; className?: string }) {
  const Icon = code === "DIRECT" ? PersonStanding : code === "PHONE" ? Phone : code === "WEBSITE" ? Globe
    : code === "FACEBOOK" || code === "ZALO" ? MessageCircle : Store;
  return <Icon className={className} />;
}

/** Nút "🚶 ▾" cạnh người bán: chọn kênh bán của hóa đơn / đơn đặt hàng (mặc định Bán trực tiếp). */
export function SaleChannelPicker({ value, onChange, lookups }: { value: string; onChange: (code: string) => void; lookups: SaleLookups }) {
  const t = useT(saleNs);
  const current = lookups.channels.find((c) => c.code === value);
  const name = current?.name ?? value;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`${t("channel.label")}: ${name}`} title={`${t("channel.label")}: ${name}`}
        className="flex h-7 items-center gap-1 rounded px-1 text-[#4b5563] hover:bg-muted">
        <ChannelIcon code={value} className="size-4" /><ChevronDown className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 p-1.5">
        <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">{t("channel.label")}</p>
        {lookups.channels.map((c) => (
          <DropdownMenuItem key={c.code} className="justify-between gap-3 py-2 text-[13px]" onClick={() => onChange(c.code)}>
            <span className="flex items-center gap-2"><ChannelIcon code={c.code} className="size-4" />{c.name}</span>
            {c.code === value && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        {!current && <DropdownMenuItem className="py-2 text-[13px]" disabled>{value}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
