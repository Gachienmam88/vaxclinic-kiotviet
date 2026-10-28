"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { periodLabel } from "@/features/accounting/accounting-labels";
import { RevenueBookTab } from "@/features/accounting/revenue-book-tab";
import { CashBookTab, StockBookTab } from "@/features/accounting/stock-and-cash-book-tabs";
import { computeTax, periodsOf, sectorResolver, type DailyExpense, type DailyRevenue } from "@/features/accounting/tax-calc";
import { TaxDeclarationTab } from "@/features/accounting/tax-declaration-tab";
import { profileBranches, useTaxSettings } from "@/features/accounting/tax-queries";
import { NativeSelect } from "@/features/products/product-form-sections";
import { useCategories } from "@/features/products/product-queries";
import { useShopSettings } from "@/features/settings/settings-queries";
import { api } from "@/lib/api-client";
import { useT } from "@/lib/i18n";
import { renderRichText } from "@/lib/i18n/render-rich-text";
import { accountingNs } from "@/messages/accounting";
import { commonNs } from "@/messages/common";

/**
 * Thuế & Kế toán hộ kinh doanh: tổng hợp nghĩa vụ thuế theo kỳ + sổ doanh thu (S1a/S2a), hàng hóa (S2d), tiền (S2e).
 * Số liệu tự lấy từ hóa đơn, trả hàng, kho, sổ quỹ của các chi nhánh thuộc mã số thuế đang chọn.
 * Khung trang được dịch; nội dung sổ + CSV kê khai giữ tiếng Việt (mã mẫu S1a/S2a/S2b/S2d/S2e-HKD không dịch).
 */
export default function AccountingPage() {
  const t = useT(accountingNs);
  const tc = useT(commonNs);
  const { data: tax } = useTaxSettings();
  const { data: shop } = useShopSettings();
  const now = new Date();
  const [taxCode, setTaxCode] = useState("");
  const [year, setYear] = useState(now.getFullYear());
  const [kind, setKind] = useState<"MONTH" | "QUARTER">("QUARTER");
  const [periodIdx, setPeriodIdx] = useState(Math.floor(now.getMonth() / 3));
  const profiles = tax?.profiles.filter((p) => p.active) ?? [];
  const profile = profiles.find((p) => p.taxCode === taxCode) ?? profiles[0];
  const branchIds = useMemo(() => (profile ? profileBranches(profile) : []), [profile]);
  const periods = periodsOf(year, kind);
  const period = periods[Math.min(periodIdx, periods.length - 1)];
  const bq = branchIds.map((b) => `&branchIds=${b}`).join("");
  const range = `from=${year}-01-01&to=${year}-12-31${bq}`;
  const { data: revenue = [] } = useQuery({ queryKey: ["revenue-daily", range], enabled: !!profile,
    queryFn: () => api<DailyRevenue[]>(`/accounting/revenue/daily?${range}`) });
  const { data: productCats = [] } = useQuery({ queryKey: ["product-categories"],
    queryFn: () => api<{ productId: string; categoryId: string | null }[]>("/accounting/stock/product-categories") });
  const { data: categories = [] } = useCategories();
  const { data: expenses = [] } = useQuery({ queryKey: ["expenses-daily", range], enabled: !!profile && profile.pitMethod === "PROFIT",
    queryFn: () => api<DailyExpense[]>(`/accounting/revenue/expenses?${range}`) });

  if (!tax) return <div className="p-6 text-sm text-muted-foreground">{tc("status.loading")}</div>;
  if (!profile) {
    return (
      <div className="rounded-lg bg-background p-6 text-sm">
        {renderRichText(t("page.noProfile"), {
          link: <Link href="/settings/tax" className="text-primary underline">{t("page.noProfileLink")}</Link>,
        })}
      </div>
    );
  }
  // Mặt hàng → nhóm hàng → (nhóm cha) → ngành nghề; không gắn → ngành mặc định
  const sectorOf = sectorResolver(new Map(productCats.map((p) => [p.productId, p.categoryId])),
    new Map(categories.map((c) => [c.id, c.parentId])), tax.categorySectors ?? {}, tax.defaultSector);
  const cfg = { vatEnabled: tax.vatEnabled, sectors: tax.sectors, sectorOf, defaultTaxCode: tax.defaultTaxCode };
  const yearly = computeTax(revenue, expenses, periods, cfg, profile);
  const formCode = profile.revenueGroup === 1 ? "S1a-HKD" : profile.pitMethod === "REVENUE" ? "S2a-HKD" : "S2b-HKD";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-4 text-lg font-bold">{t("page.title")}</h1>
        <div className="w-56"><NativeSelect value={profile.taxCode} onChange={(e) => setTaxCode(e.target.value)}>
          {profiles.map((p) => <option key={p.taxCode} value={p.taxCode}>{t("page.taxCodeOption", { code: p.taxCode })}</option>)}</NativeSelect></div>
        <div className="w-28"><NativeSelect value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[0, 1, 2].map((i) => now.getFullYear() - i).map((y) => <option key={y} value={y}>{t("page.yearOption", { year: y })}</option>)}</NativeSelect></div>
        <div className="w-28"><NativeSelect value={kind} onChange={(e) => { setKind(e.target.value as "MONTH" | "QUARTER"); setPeriodIdx(0); }}>
          <option value="QUARTER">{t("page.byQuarter")}</option><option value="MONTH">{t("page.byMonth")}</option></NativeSelect></div>
        <div className="w-32"><NativeSelect value={periodIdx} onChange={(e) => setPeriodIdx(Number(e.target.value))}>
          {periods.map((p, i) => <option key={p.label} value={i}>{periodLabel(t, p)}</option>)}</NativeSelect></div>
        <span className="text-xs text-muted-foreground">{t("page.periodHint")}</span>
      </div>
      <div className="rounded-lg bg-background p-4">
        <Tabs defaultValue="declaration">
          <div className="flex items-center gap-2">
            <TabsList variant="line">
              <TabsTrigger value="declaration">{t("page.tabs.declaration")}</TabsTrigger>
              <TabsTrigger value="revenue">{t("page.tabs.revenue", { code: formCode })}</TabsTrigger>
              <TabsTrigger value="stock">{t("page.tabs.stock", { code: "S2d-HKD" })}</TabsTrigger>
              <TabsTrigger value="cash">{t("page.tabs.cash", { code: "S2e-HKD" })}</TabsTrigger>
            </TabsList>
            <span className="ml-auto text-muted-foreground print:hidden" title={tc("legal.vietnameseOnly")}>
              <Info className="size-4" aria-label={tc("legal.vietnameseOnly")} />
            </span>
          </div>
          <TabsContent value="declaration" className="pt-3"><TaxDeclarationTab rows={yearly} tax={tax} profile={profile} year={year} periodIdx={Math.min(periodIdx, periods.length - 1)} /></TabsContent>
          <TabsContent value="revenue" className="pt-3">
            <RevenueBookTab rows={revenue} period={period} cfg={cfg} formCode={formCode} storeName={shop?.store?.name ?? ""} taxCode={profile.taxCode} />
          </TabsContent>
          <TabsContent value="stock" className="pt-3"><StockBookTab period={period} branchIds={branchIds} /></TabsContent>
          <TabsContent value="cash" className="pt-3"><CashBookTab period={period} branchIds={branchIds} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
