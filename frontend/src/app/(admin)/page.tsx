"use client";

import { useState } from "react";
import { RecentActivityCard } from "@/features/dashboard/recent-activity-card";
import { RevenueChartCard } from "@/features/dashboard/revenue-chart-card";
import { TodaySalesSummaryCard } from "@/features/dashboard/today-sales-summary-card";
import { TopProductsCard } from "@/features/dashboard/top-products-card";
import { useDailyRevenue, useInvoiceCount, useRecentActivities } from "@/features/dashboard/dashboard-queries";
import { useCurrentUser } from "@/lib/use-current-user";

/**
 * Tổng quan: kết quả bán hàng hôm nay, biểu đồ doanh thu thuần, top 10 hàng bán chạy, hoạt động gần đây.
 * Số liệu lấy thật từ /accounting/revenue/daily (1 lần cho đầu tháng trước → hôm nay), /invoices, /audit-logs.
 */
export default function DashboardPage() {
  const { data: me, can, isLoading: meLoading } = useCurrentUser();
  const [today] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); });
  const canRevenue = can("report.view") || can("cashbook.manage");
  const canInvoices = can("sales.perform") || can("report.view");
  const canAudit = can("user.manage");
  const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const { data: rows = [], isLoading } = useDailyRevenue(from, today, canRevenue);
  const { data: invoiceCount } = useInvoiceCount(today, today, canInvoices);
  const activities = useRecentActivities(canAudit);

  if (meLoading) return <div className="p-6 text-[13px] text-muted-foreground">Đang tải...</div>;
  if (!canRevenue) {
    return (
      <section className="rounded-lg bg-background px-5 py-4 text-[13px]">
        <h2 className="mb-2 text-[15px] font-semibold">Xin chào, {me?.user.fullName}</h2>
        <p className="text-muted-foreground">Vai trò: {me?.user.roleName}</p>
        <p className="text-muted-foreground">Chi nhánh làm việc: {me?.user.branches.map((b) => b.name).join(", ")}</p>
        <p className="mt-2 text-muted-foreground">Tài khoản chưa có quyền xem báo cáo doanh thu.</p>
      </section>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3 lg:flex-row">
      <div className="w-full min-w-0 flex-1 space-y-3">
        <TodaySalesSummaryCard rows={rows} invoiceCount={invoiceCount} today={today} />
        {isLoading ? <div className="rounded-lg bg-background p-6 text-[13px] text-muted-foreground">Đang tải doanh thu...</div> : (
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
