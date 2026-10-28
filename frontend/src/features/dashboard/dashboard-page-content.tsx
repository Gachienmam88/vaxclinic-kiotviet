"use client";

import { useState } from "react";
import { RecentActivityCard } from "./recent-activity-card";
import { RevenueChartCard } from "./revenue-chart-card";
import { TodaySalesSummaryCard } from "./today-sales-summary-card";
import { TopProductsCard } from "./top-products-card";
import { useDailyRevenue, useInvoiceCount, useRecentActivities } from "./dashboard-queries";
import { useT } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/use-current-user";
import { commonNs } from "@/messages/common";
import { dashboardNs } from "@/messages/dashboard";

/**
 * Tổng quan: kết quả bán hàng hôm nay, biểu đồ doanh thu thuần, top 10 hàng bán chạy, hoạt động gần đây.
 * Số liệu lấy thật từ /accounting/revenue/daily (1 lần cho đầu tháng trước → hôm nay), /invoices, /audit-logs.
 */
export function DashboardPageContent() {
  const t = useT(dashboardNs);
  const tc = useT(commonNs);
  const { data: me, can, isLoading: meLoading } = useCurrentUser();
  const [today] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); });
  const canRevenue = can("report.view") || can("cashbook.manage");
  const canInvoices = can("sales.perform") || can("report.view");
  const canAudit = can("user.manage");
  const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const { data: rows = [], isLoading } = useDailyRevenue(from, today, canRevenue);
  const { data: invoiceCount } = useInvoiceCount(today, today, canInvoices);
  const activities = useRecentActivities(canAudit);

  if (meLoading) return <div className="p-6 text-[13px] text-muted-foreground">{tc("status.loading")}</div>;
  if (!canRevenue) {
    return (
      <section className="rounded-lg bg-background px-5 py-4 text-[13px]">
        <h2 className="mb-2 text-[15px] font-semibold">{t("page.hello", { name: me?.user.fullName ?? "" })}</h2>
        <p className="text-muted-foreground">{t("page.role", { role: me?.user.roleName ?? "" })}</p>
        <p className="text-muted-foreground">{t("page.branches", { branches: me?.user.branches.map((b) => b.name).join(", ") ?? "" })}</p>
        <p className="mt-2 text-muted-foreground">{t("page.noRevenuePermission")}</p>
      </section>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3 lg:flex-row">
      <div className="w-full min-w-0 flex-1 space-y-3">
        <TodaySalesSummaryCard rows={rows} invoiceCount={invoiceCount} today={today} />
        {isLoading ? <div className="rounded-lg bg-background p-6 text-[13px] text-muted-foreground">{t("page.loadingRevenue")}</div> : (
          <>
            <RevenueChartCard rows={rows} today={today} canInvoices={canInvoices} />
            <TopProductsCard rows={rows} today={today} />
          </>
        )}
      </div>
      {canAudit && (
        <aside className="w-full shrink-0 lg:sticky lg:top-28 lg:w-[250px]">
          <RecentActivityCard items={activities.data ?? []} isLoading={activities.isLoading} />
        </aside>
      )}
    </div>
  );
}
