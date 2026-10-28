"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; perm?: string };
type NavGroup = { title?: string; links: NavLink[] };
type NavItem = { href: string; label: string; perm?: string; groups?: NavGroup[] };

/**
 * Menu xanh theo KiotViet: rê chuột vào mục có nhóm con → bảng xổ xuống chia cột, mỗi cột có tiêu đề nhóm.
 * Chỉ liệt kê màn đã làm thật (chưa có: Giao hàng — vận đơn, đối tác giao hàng).
 */
const NAV: NavItem[] = [
  { href: "/", label: "Tổng quan" },
  {
    href: "/products", label: "Hàng hóa", perm: "catalog.view",
    groups: [
      { title: "Hàng hóa", links: [
        { href: "/products", label: "Danh sách hàng hóa" }, { href: "/products/price-books", label: "Thiết lập giá" },
      ] },
      { title: "Kho hàng", links: [
        { href: "/inventory/stock-takes", label: "Kiểm kho", perm: "inventory.view" },
        { href: "/inventory/internal-use", label: "Xuất dùng nội bộ", perm: "inventory.view" },
        { href: "/inventory/damages", label: "Xuất hủy", perm: "inventory.view" },
      ] },
    ],
  },
  {
    href: "/purchases", label: "Mua hàng", perm: "inventory.view",
    groups: [
      { title: "Nhà cung cấp", links: [
        { href: "/purchases/suppliers", label: "Nhà cung cấp" },
        { href: "/purchases/input-invoices", label: "Hóa đơn đầu vào" },
      ] },
      { title: "Mua hàng", links: [
        { href: "/purchases/receipts", label: "Nhập hàng" },
        { href: "/purchases/returns", label: "Trả hàng nhập" },
      ] },
    ],
  },
  {
    href: "/invoices", label: "Đơn hàng", perm: "sales.perform",
    groups: [
      { title: "Đơn hàng", links: [
        { href: "/orders", label: "Đặt hàng" }, { href: "/invoices", label: "Hóa đơn" }, { href: "/returns", label: "Trả hàng" },
      ] },
      { title: "Giao hàng", links: [
        { href: "/delivery/shipments", label: "Vận đơn" }, { href: "/delivery", label: "Quản lý giao hàng" },
        { href: "/delivery/partners", label: "Đối tác giao hàng" },
      ] },
    ],
  },
  {
    href: "/customers", label: "Khách hàng", perm: "patient.view",
    groups: [{ title: "Khách hàng", links: [
      { href: "/customers", label: "Khách hàng" }, { href: "/customers/groups", label: "Nhóm khách hàng" },
    ] }],
  },
  {
    href: "/employees", label: "Nhân viên", perm: "hr.manage",
    groups: [{ links: [
      { href: "/employees", label: "Danh sách nhân viên" },
      { href: "/employees/schedules", label: "Lịch làm việc" },
      { href: "/employees/timesheets", label: "Bảng chấm công" },
      { href: "/employees/payrolls", label: "Bảng lương" },
      { href: "/employees/commissions", label: "Bảng hoa hồng" },
      { href: "/employees/settings/start", label: "Thiết lập nhân viên" },
    ] }],
  },
  { href: "/cashbook", label: "Sổ quỹ", perm: "cashbook.manage" },
  {
    href: "/reports", label: "Báo cáo", perm: "report.view",
    groups: [{ links: [
      { href: "/reports/end-of-day", label: "Cuối ngày" },
      { href: "/reports/sales", label: "Bán hàng" },
      { href: "/reports/orders", label: "Đặt hàng" },
      { href: "/reports/products", label: "Hàng hóa" },
      { href: "/reports/customers", label: "Khách hàng" },
      { href: "/reports/suppliers", label: "Nhà cung cấp" },
      { href: "/reports/employees", label: "Nhân viên" },
      { href: "/reports/channels", label: "Kênh bán hàng" },
      { href: "/reports/finance", label: "Tài chính" },
    ] }],
  },
  { href: "/accounting", label: "Thuế & Kế toán", perm: "report.view" },
];

/** Số đo theo ảnh KiotViet: mục menu cao 32px, chữ 13px đậm, đang chọn / đang rê nền xanh đậm bo 6px. */
const navClass = (active: boolean) =>
  cn("flex h-8 items-center rounded-md px-4 text-[13px] font-semibold group-hover:bg-[#0058c7] hover:bg-[#0058c7]", active && "bg-[#0058c7]");

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

/** Bảng xổ xuống: nền trắng bo 8px, đổ bóng, cột rộng ~166px ngăn bằng vạch dọc; tiêu đề nhóm 11px xám, mục 13px cao 32px. */
function MegaPanel({ groups, pathname }: { groups: NavGroup[]; pathname: string }) {
  // Bấm chọn xong thì bỏ focus để bảng đóng lại (bảng mở khi rê chuột hoặc khi focus bằng bàn phím)
  const close = () => (document.activeElement as HTMLElement | null)?.blur();
  // Mục đang mở = href khớp dài nhất (vd. /customers/groups không tô cả "Khách hàng")
  const current = groups.flatMap((g) => g.links).map((l) => l.href)
    .filter((h) => pathname === h || pathname.startsWith(h + "/")).sort((a, b) => b.length - a.length)[0];
  return (
    <div className="invisible absolute left-0 top-full z-50 pt-1 opacity-0 transition-opacity duration-100 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
      <div className="flex rounded-lg bg-background py-2 text-foreground shadow-[0_4px_16px_rgba(0,0,0,0.14)]">
        {groups.map((g, i) => (
          <div key={g.title ?? i} className={cn("w-[166px] px-1.5", i > 0 && "border-l border-[#e5e7eb]")}>
            {g.title && <p className="px-2.5 pb-1 pt-0.5 text-[11px] font-semibold text-[#6b7280]">{g.title}</p>}
            {g.links.map((l) => (
              <Link key={l.href} href={l.href} onClick={close}
                className={cn("flex h-8 items-center rounded-md px-2.5 text-[13px] font-normal hover:bg-[#f3f4f6]",
                  l.href === current && "text-primary")}>
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Các mục menu trên thanh xanh (lọc theo quyền). */
export function AppHeaderNavMenu({ can }: { can: (perm: string) => boolean }) {
  const pathname = usePathname();
  return NAV.filter((item) => !item.perm || can(item.perm)).map((item) => {
    const groups = item.groups?.map((g) => ({ ...g, links: g.links.filter((l) => !l.perm || can(l.perm)) })).filter((g) => g.links.length);
    const active = groups?.length
      ? groups.some((g) => g.links.some((l) => isActive(pathname, l.href))) || isActive(pathname, item.href)
      : isActive(pathname, item.href);
    if (!groups?.length) return <Link key={item.href} href={item.href} className={navClass(active)}>{item.label}</Link>;
    return (
      <div key={item.href} className="group relative">
        <Link href={groups[0].links[0].href} className={navClass(active)} aria-haspopup="true">{item.label}</Link>
        <MegaPanel groups={groups} pathname={pathname} />
      </div>
    );
  });
}
