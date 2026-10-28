"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RevenueBookTab } from "@/features/accounting/revenue-book-tab";
import { CashBookTab, StockBookTab } from "@/features/accounting/stock-and-cash-book-tabs";
import { computeTax, periodsOf, sectorResolver, type DailyExpense, type DailyRevenue } from "@/features/accounting/tax-calc";
import { TaxDeclarationTab } from "@/features/accounting/tax-declaration-tab";
import { profileBranches, useTaxSettings } from "@/features/accounting/tax-queries";
import { NativeSelect } from "@/features/products/product-form-sections";
import { useCategories } from "@/features/products/product-queries";
import { useShopSettings } from "@/features/settings/settings-queries";
import { api } from "@/lib/api-client";

/**
 * Thuế & Kế toán hộ kinh doanh: tổng hợp nghĩa vụ thuế theo kỳ + sổ doanh thu (S1a/S2a), hàng hóa (S2d), tiền (S2e).
 * Số liệu tự lấy từ hóa đơn, trả hàng, kho, sổ quỹ của các chi nhánh thuộc mã số thuế đang chọn.
 */
export default function AccountingPage() {
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

  if (!tax) return <div className="p-6 text-sm text-muted-foreground">Đang tải...</div>;
  if (!profile) {
    return (
      <div className="rounded-lg bg-background p-6 text-sm">
        Chưa có hồ sơ kê khai thuế đang hoạt động. Vào <Link href="/settings/tax" className="text-primary underline">Thiết lập → Thuế &amp; Kế toán</Link> để
        thêm mã số thuế, nhóm doanh thu và địa điểm kinh doanh.
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
        <h1 className="mr-4 text-lg font-bold">Thuế &amp; Kế toán</h1>
        <div className="w-56"><NativeSelect value={profile.taxCode} onChange={(e) => setTaxCode(e.target.value)}>
          {profiles.map((p) => <option key={p.taxCode} value={p.taxCode}>MST {p.taxCode}</option>)}</NativeSelect></div>
        <div className="w-28"><NativeSelect value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[0, 1, 2].map((i) => now.getFullYear() - i).map((y) => <option key={y} value={y}>Năm {y}</option>)}</NativeSelect></div>
        <div className="w-28"><NativeSelect value={kind} onChange={(e) => { setKind(e.target.value as "MONTH" | "QUARTER"); setPeriodIdx(0); }}>
          <option value="QUARTER">Theo quý</option><option value="MONTH">Theo tháng</option></NativeSelect></div>
        <div className="w-32"><NativeSelect value={periodIdx} onChange={(e) => setPeriodIdx(Number(e.target.value))}>
          {periods.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}</NativeSelect></div>
        <span className="text-xs text-muted-foreground">Kỳ đang chọn áp dụng cho các sổ; tờ khai hiện đủ các kỳ trong năm.</span>
      </div>
      <div className="rounded-lg bg-background p-4">
        <Tabs defaultValue="declaration">
          <TabsList variant="line">
            <TabsTrigger value="declaration">Tờ khai & nghĩa vụ thuế</TabsTrigger>
            <TabsTrigger value="revenue">Sổ doanh thu ({formCode})</TabsTrigger>
            <TabsTrigger value="stock">Sổ hàng hóa (S2d-HKD)</TabsTrigger>
            <TabsTrigger value="cash">Sổ tiền (S2e-HKD)</TabsTrigger>
          </TabsList>
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
