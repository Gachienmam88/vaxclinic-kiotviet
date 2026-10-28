"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Mã chứng từ / danh mục theo KiotViet: chữ xanh #2171bc, rê chuột xanh nhạt #1a9dcc (đo trên ảnh Báo cáo cuối ngày),
 * bấm → trang danh sách tương ứng lọc đúng mã và mở sẵn dòng chi tiết (?code=…).
 * Tiền tố dài khớp trước (THN trước TH, PCPL trước PC…). Mã lạ / không có trang → chữ thường, không link.
 */
const ROUTES: [prefix: string, path: string][] = [
  ["PCPL", "/cashbook"], ["PCTU", "/cashbook"], ["CKTT", "/cashbook"],
  ["NCC", "/purchases/suppliers"], ["THN", "/purchases/returns"], ["XNB", "/inventory/internal-use"],
  ["PCN", "/purchases/suppliers"], ["CKN", "/purchases/suppliers"], ["DCN", "/purchases/suppliers"],
  ["SP", "/products"], ["HD", "/invoices"], ["TH", "/returns"], ["PN", "/purchases/receipts"], ["DH", "/orders"],
  ["KH", "/customers"], ["KK", "/inventory/stock-takes"], ["XH", "/inventory/damages"], ["VD", "/delivery/shipments"],
  ["DT", "/delivery/partners"], ["NV", "/employees"], ["BL", "/employees/payrolls"],
  ["PT", "/cashbook"], ["PC", "/cashbook"], ["TT", "/cashbook"], ["DC", "/cashbook"],
];

/** Trang chi tiết của một mã (null nếu không nhận ra). `kind` ép trang khi tiền tố trùng nghĩa. */
export function docCodeHref(code: string, kind?: string): string | null {
  const path = kind ?? ROUTES.find(([p]) => code.startsWith(p) && /^\d/.test(code.slice(p.length)))?.[1];
  return path ? `${path}?code=${encodeURIComponent(code)}` : null;
}

export const DOC_CODE_LINK_CLASS = "text-[#2171bc] hover:text-[#1a9dcc] hover:underline";

/** `to` = đường dẫn đầy đủ khi đã biết (vd. theo id); `kind` = đường dẫn trang danh sách; `newTab` cho màn bán hàng. */
export function DocCodeLink({ code, to, kind, newTab, className, onClick }: {
  code: string | null | undefined; to?: string; kind?: string; newTab?: boolean; className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  if (!code) return null;
  const href = to ?? docCodeHref(code, kind);
  if (!href) return <span className={className}>{code}</span>;
  return (
    <Link href={href} target={newTab ? "_blank" : undefined} prefetch={false}
      className={cn(DOC_CODE_LINK_CLASS, className)}
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}>
      {code}
    </Link>
  );
}
