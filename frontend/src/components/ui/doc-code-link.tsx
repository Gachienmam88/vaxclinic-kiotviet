"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Mã chứng từ / danh mục theo KiotViet: chữ xanh #2171bc, rê chuột xanh nhạt #1a9dcc (đo trên ảnh Báo cáo cuối ngày),
 * bấm → trang danh sách tương ứng lọc đúng mã và mở sẵn dòng chi tiết (?code=…).
 * Tiền tố dài khớp trước (THN trước TH, PCPL trước PC…). Sau tiền tố là số, hoặc mã chứng từ gốc rồi số:
 * phiếu Sổ quỹ tự sinh = "PC"/"PT"/"TT" + mã gốc (PCPN000001, PTDS000002, TTHD000123-2…).
 * Mã lạ / không có trang → chữ thường, không link. CKTT / DC (chiết khấu / điều chỉnh công nợ khách) chỉ nằm trong
 * sổ nợ khách, không sinh phiếu Sổ quỹ → nơi hiển thị truyền `to` (trang khách hàng) nếu muốn link.
 */
const ROUTES: [prefix: string, path: string][] = [
  ["PCPL", "/cashbook"], ["PCTU", "/cashbook"],
  ["NCC", "/purchases/suppliers"], ["THN", "/purchases/returns"], ["XNB", "/inventory/internal-use"],
  ["PCN", "/purchases/suppliers"], ["CKN", "/purchases/suppliers"], ["DCN", "/purchases/suppliers"],
  ["SP", "/products"], ["HD", "/invoices"], ["TH", "/returns"], ["PN", "/purchases/receipts"], ["DH", "/orders"],
  ["KH", "/customers"], ["KK", "/inventory/stock-takes"], ["XH", "/inventory/damages"], ["VD", "/delivery/shipments"],
  ["DT", "/delivery/partners"], ["DS", "/delivery/partners"], ["NV", "/employees"], ["BL", "/employees/payrolls"],
  ["PT", "/cashbook"], ["PC", "/cashbook"], ["TT", "/cashbook"],
];
/** Sau tiền tố: số, hoặc mã gốc 2–3 chữ + số (PC + PN000001). */
const AFTER_PREFIX = /^(?:[A-Z]{2,3})?\d/;

/** Trang chi tiết của một mã (null nếu không nhận ra). `kind` ép trang khi tiền tố trùng nghĩa. */
export function docCodeHref(code: string, kind?: string): string | null {
  const c = code.trim().toUpperCase();
  const path = kind ?? ROUTES.find(([p]) => c.startsWith(p) && AFTER_PREFIX.test(c.slice(p.length)))?.[1];
  return path ? `${path}?code=${encodeURIComponent(code.trim())}` : null;
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
