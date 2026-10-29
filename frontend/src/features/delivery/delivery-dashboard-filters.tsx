"use client";

import { useState } from "react";
import { Check, ChevronDown, Info, Search } from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { PickerPopover } from "@/components/ui/picker-popover";
import { addDays, ymd } from "@/features/dashboard/dashboard-date-utils";
import { parseYmd, presetRange } from "@/features/reports/report-time-presets";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { deliveryNs } from "@/messages/delivery";
import { usePartnerOptions } from "./delivery-queries";

/** Bộ lọc Quản lý giao hàng: hình thức kết nối, đối tác ("OTHER" = mọi đối tác tự quản lý), thời gian tạo đơn. */
export type DashFilters = { connection: "" | "MANUAL"; partner: string; time: DashPreset; from: string; to: string };
export type DashPreset = "today" | "yesterday" | "last7" | "thisMonth" | "lastMonth" | "custom";
export const DEFAULT_DASH: DashFilters = { connection: "", partner: "", time: "last7", from: "", to: "" };
const PRESETS: DashPreset[] = ["today", "yesterday", "last7", "thisMonth", "lastMonth", "custom"];

const BOX = "flex h-[30px] w-full items-center gap-2 rounded-md border-0 bg-[#eef0f3] px-2.5 text-left text-[13px] hover:bg-[#e5e7eb] data-popup-open:ring-1 data-popup-open:ring-primary";
const ITEM = "flex h-8 w-full items-center justify-between rounded px-2.5 text-left text-[13px] hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

/** Khoảng ngày [from, to] (yyyy-MM-dd) của bộ lọc thời gian. */
export function dashRange(f: DashFilters) {
  if (f.time === "custom" && f.from && f.to) return { from: f.from, to: f.to };
  const r = presetRange(f.time === "custom" ? "last7" : f.time);
  return { from: ymd(r.from), to: ymd(r.to) };
}

/** → query /shipments/dashboard | /cashflow: [from, to) ISO + partnerId / connection. */
export function dashParams(f: DashFilters) {
  const r = dashRange(f);
  const p = new URLSearchParams({ from: parseYmd(r.from).toISOString(), to: addDays(parseYmd(r.to), 1).toISOString() });
  if (f.partner && f.partner !== "OTHER") p.set("partnerId", f.partner);
  if (f.connection || f.partner === "OTHER") p.set("connection", "MANUAL");
  return p;
}

function Pick({ label, value, children, open, setOpen }: {
  label: string; value: string; children: React.ReactNode; open: boolean; setOpen: (o: boolean) => void;
}) {
  return (
    <PickerPopover open={open} onOpenChange={setOpen} label={label} align="start" className="w-[230px] p-1.5" triggerClassName={BOX}
      icon={<><span className="flex-1 truncate">{value}</span><ChevronDown className="size-4 text-muted-foreground" /></>}>{children}</PickerPopover>
  );
}

export function DeliveryDashboardFilters({ value, onChange }: { value: DashFilters; onChange: (f: DashFilters) => void }) {
  const t = useT(deliveryNs);
  const { data: partners = [] } = usePartnerOptions();
  const [open, setOpen] = useState<"conn" | "partner" | "time" | null>(null);
  const [q, setQ] = useState("");
  const set = (p: Partial<DashFilters>) => { onChange({ ...value, ...p }); setOpen(null); };
  const tick = (on: boolean) => on && <Check className="size-4 text-primary" />;
  const partnerName = value.partner === "OTHER" ? t("kv.dash.other") : partners.find((p) => p.id === value.partner)?.name;
  const shown = partners.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.code.toLowerCase().includes(q.toLowerCase()));
  const label = (k: string) => <span className="mb-1 block text-xs text-muted-foreground">{k}</span>;

  return (
    <div className="space-y-3 rounded-lg bg-background p-3">
      <div>{label(t("kv.dash.connection"))}
        <Pick label={t("kv.dash.connection")} value={value.connection ? t("kv.dash.connSelf") : t("kv.dash.pickConnection")}
          open={open === "conn"} setOpen={(o) => setOpen(o ? "conn" : null)}>
          <button type="button" className={ITEM} onClick={() => set({ connection: "" })}>{t("kv.common.all")}{tick(!value.connection)}</button>
          {[t("kv.dash.connPortal"), t("kv.dash.connCarrier")].map((l) => (
            <button key={l} type="button" disabled className={ITEM} title={t("kv.dash.notConnected")}>{l}
              <span className="text-[11px]">{t("kv.dash.notConnected")}</span></button>))}
          <button type="button" className={ITEM} onClick={() => set({ connection: "MANUAL" })}>{t("kv.dash.connSelf")}{tick(value.connection === "MANUAL")}</button>
        </Pick></div>
      <div>{label(t("kv.dash.partner"))}
        <Pick label={t("kv.dash.partner")} value={partnerName ?? t("kv.list.pickPartner")} open={open === "partner"}
          setOpen={(o) => { setOpen(o ? "partner" : null); setQ(""); }}>
          <div className="relative mb-1"><Search className="absolute top-2 left-2 size-4 text-muted-foreground" />
            <input data-picker-focus="" className="h-8 w-full rounded-md border pl-8 text-[13px] outline-none focus:border-primary"
              placeholder={t("kv.dash.search")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="max-h-64 overflow-y-auto">
            <button type="button" className={ITEM} onClick={() => set({ partner: "" })}>{t("kv.common.all")}{tick(!value.partner)}</button>
            {shown.map((p) => <button key={p.id} type="button" className={ITEM} onClick={() => set({ partner: p.id })}>
              <span className="truncate">{p.name}</span>{tick(value.partner === p.id)}</button>)}
            <button type="button" className={ITEM} onClick={() => set({ partner: "OTHER" })}>{t("kv.dash.other")}{tick(value.partner === "OTHER")}</button>
          </div>
        </Pick></div>
      <div><span className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">{t("kv.dash.createdTime")}
        <span title={t("kv.dash.createdTimeTip")} className="inline-flex"><Info className="size-3.5" /></span></span>
        <Pick label={t("kv.dash.createdTime")} value={t(`kv.dash.${value.time}`)} open={open === "time"} setOpen={(o) => setOpen(o ? "time" : null)}>
          {PRESETS.map((p) => <button key={p} type="button" className={cn(ITEM, value.time === p && "text-primary")}
            onClick={() => (p === "custom" ? onChange({ ...value, time: "custom", ...dashRange(value) }) : set({ time: p }))}>
            {t(`kv.dash.${p}`)}{tick(value.time === p)}</button>)}
        </Pick>
        {value.time === "custom" && <DateRangePicker className={cn(BOX, "mt-2")} value={{ from: value.from, to: value.to }}
          onChange={(r) => onChange({ ...value, time: "custom", from: r.from, to: r.to })} />}
      </div>
    </div>
  );
}
