"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT, type MessageKey, type TFunction } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { navNs } from "@/messages/nav";

/** label / title là khóa trong messages/<locale>/nav.json — dịch lúc render. */
type NavKey = MessageKey<typeof navNs.vi>;
type NavLink = { href: string; label: NavKey; perm?: string };
type NavGroup = { title?: NavKey; links: NavLink[] };
type NavItem = { href: string; label: NavKey; perm?: string; groups?: NavGroup[] };

/**
 * Menu xanh theo KiotViet: rê chuột vào mục có nhóm con → bảng xổ xuống chia cột, mỗi cột có tiêu đề nhóm.
 * Chỉ liệt kê màn đã làm thật.
 */
const NAV: NavItem[] = [
  { href: "/", label: "menu.overview" },
  {
    href: "/products", label: "menu.products", perm: "catalog.view",
    groups: [
      { title: "groups.products", links: [
        { href: "/products", label: "links.productList" }, { href: "/products/price-books", label: "links.priceBooks" },
      ] },
      { title: "groups.warehouse", links: [
        { href: "/inventory/stock-takes", label: "links.stockTakes", perm: "inventory.view" },
        { href: "/inventory/internal-use", label: "links.internalUse", perm: "inventory.view" },
        { href: "/inventory/damages", label: "links.damages", perm: "inventory.view" },
      ] },
    ],
  },
  {
    href: "/purchases", label: "menu.purchases", perm: "inventory.view",
    groups: [
      { title: "groups.suppliers", links: [
        { href: "/purchases/suppliers", label: "links.suppliers" },
        { href: "/purchases/input-invoices", label: "links.inputInvoices" },
      ] },
      { title: "groups.purchasing", links: [
        { href: "/purchases/receipts", label: "links.receipts" },
        { href: "/purchases/returns", label: "links.purchaseReturns" },
      ] },
    ],
  },
  {
    href: "/invoices", label: "menu.orders", perm: "sales.perform",
    groups: [
      { title: "groups.orders", links: [
        { href: "/orders", label: "links.orderBooking" }, { href: "/invoices", label: "links.invoices" }, { href: "/returns", label: "links.returns" },
      ] },
      { title: "groups.delivery", links: [
        { href: "/delivery/shipments", label: "links.shipments" }, { href: "/delivery", label: "links.deliveryManagement" },
        { href: "/delivery/partners", label: "links.deliveryPartners" },
      ] },
    ],
  },
  {
    href: "/customers", label: "menu.customers", perm: "patient.view",
    groups: [{ title: "groups.customers", links: [
      { href: "/customers", label: "links.customers" }, { href: "/customers/groups", label: "links.customerGroups" },
    ] }],
  },
  {
    href: "/employees", label: "menu.employees", perm: "hr.manage",
    groups: [{ links: [
      { href: "/employees", label: "links.employeeList" },
      { href: "/employees/schedules", label: "links.schedules" },
      { href: "/employees/timesheets", label: "links.timesheets" },
      { href: "/employees/payrolls", label: "links.payrolls" },
      { href: "/employees/commissions", label: "links.commissions" },
      { href: "/employees/settings/start", label: "links.employeeSettings" },
    ] }],
  },
  { href: "/cashbook", label: "menu.cashbook", perm: "cashbook.manage" },
  {
    href: "/reports", label: "menu.reports", perm: "report.view",
    groups: [{ title: "groups.reports", links: [
      { href: "/reports/end-of-day", label: "links.reportEndOfDay" },
      { href: "/reports/sales", label: "links.reportSales" },
      { href: "/reports/orders", label: "links.reportOrders" },
      { href: "/reports/products", label: "links.reportProducts" },
      { href: "/reports/customers", label: "links.reportCustomers" },
      { href: "/reports/suppliers", label: "links.reportSuppliers" },
      { href: "/reports/employees", label: "links.reportEmployees" },
      { href: "/reports/channels", label: "links.reportChannels" },
      { href: "/reports/finance", label: "links.reportFinance" },
    ] }],
  },
  { href: "/accounting", label: "menu.accounting", perm: "report.view" },
];

/** Số đo theo ảnh KiotViet: mục menu cao 32px, chữ 13px đậm, đang chọn / đang rê nền màu chủ đề đậm (× 0.8) bo 6px. */
const navClass = (active: boolean) =>
  cn("flex h-8 items-center rounded-md px-4 text-[13px] font-semibold group-hover:bg-chrome-active hover:bg-chrome-active", active && "bg-chrome-active");

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

/** Nhóm dài chia cột như KiotViet (Báo cáo: 5 + 4 mục), tối đa 5 mục mỗi cột. */
const COLUMN_ROWS = 5;
const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/**
 * Bảng xổ xuống — số đo từ ảnh KiotViet (zoom 67%) quy về kích thước gốc của app (phần quản lý phóng 1.12):
 * cột rộng 222px, mục cao 43px, chữ 13px; tiêu đề nhóm 11px xám, chung cho các cột của nhóm; vạch dọc chỉ ngăn giữa các nhóm.
 */
function MegaPanel({ groups, pathname, t }: { groups: NavGroup[]; pathname: string; t: TFunction<typeof navNs.vi> }) {
  // Bấm chọn xong thì bỏ focus để bảng đóng lại (bảng mở khi rê chuột hoặc khi focus bằng bàn phím)
  const close = () => (document.activeElement as HTMLElement | null)?.blur();
  // Mục đang mở = href khớp dài nhất (vd. /customers/groups không tô cả "Khách hàng")
  const current = groups.flatMap((g) => g.links).map((l) => l.href)
    .filter((h) => pathname === h || pathname.startsWith(h + "/")).sort((a, b) => b.length - a.length)[0];
  return (
    <div className="invisible absolute left-0 top-full z-50 pt-1 opacity-0 transition-opacity duration-100 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
      <div className="flex rounded-lg bg-background pb-1 text-foreground shadow-[0_4px_16px_rgba(0,0,0,0.14)]">
        {groups.map((g, i) => (
          <div key={g.title ?? i} className={cn("px-1.5", i > 0 && "border-l border-[#e5e7eb]", !g.title && "pt-1")}>
            {g.title && <p className="px-2.5 pt-[11px] pb-[5px] text-[11px] leading-[14px] font-semibold text-[#6b7280]">{t(g.title)}</p>}
            <div className="flex">
              {chunk(g.links, COLUMN_ROWS).map((col, c) => (
                <div key={c} className="w-[222px]">
                  {col.map((l) => (
                    <Link key={l.href} href={l.href} onClick={close}
                      className={cn("flex h-[43px] items-center rounded-md px-2.5 text-[13px] font-normal hover:bg-[#f3f4f6]",
                        l.href === current && "text-primary")}>
                      {t(l.label)}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Các mục menu trên thanh xanh (lọc theo quyền). */
export function AppHeaderNavMenu({ can }: { can: (perm: string) => boolean }) {
  const pathname = usePathname();
  const t = useT(navNs);
  return NAV.filter((item) => !item.perm || can(item.perm)).map((item) => {
    const groups = item.groups?.map((g) => ({ ...g, links: g.links.filter((l) => !l.perm || can(l.perm)) })).filter((g) => g.links.length);
    const active = groups?.length
      ? groups.some((g) => g.links.some((l) => isActive(pathname, l.href))) || isActive(pathname, item.href)
      : isActive(pathname, item.href);
    if (!groups?.length) return <Link key={item.href} href={item.href} className={navClass(active)}>{t(item.label)}</Link>;
    return (
      <div key={item.href} className="group relative">
        <Link href={groups[0].links[0].href} className={navClass(active)} aria-haspopup="true">{t(item.label)}</Link>
        <MegaPanel groups={groups} pathname={pathname} t={t} />
      </div>
    );
  });
}
