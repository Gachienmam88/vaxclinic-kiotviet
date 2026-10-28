"use client";

import { Fragment, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

/** Link sâu của trang danh sách: ?code=<mã> (mã chứng từ / danh mục, xem doc-code-link) và/hoặc ?id=<uuid>. */
export type DeepLink = { code: string | null; id: string | null };

function DeepLinkInner({ children }: { children: (link: DeepLink) => React.ReactNode }) {
  const sp = useSearchParams();
  const code = (sp.get("code") ?? sp.get("Code"))?.trim() || null;
  // Đổi query khi đang ở trang (bấm link khác cùng trang) → dựng lại trang với bộ lọc của link mới
  return <Fragment key={sp.toString()}>{children({ code, id: sp.get("id") })}</Fragment>;
}

/** Bọc trang danh sách: đọc ?code= / ?id= (cần Suspense cho useSearchParams) rồi render trang theo link. */
export function DeepLinkRoute({ children }: { children: (link: DeepLink) => React.ReactNode }) {
  return <Suspense><DeepLinkInner>{children}</DeepLinkInner></Suspense>;
}

/** So khớp mã không phân biệt hoa thường / khoảng trắng. */
export function sameCode(a: string | null | undefined, b: string | null | undefined) {
  return !!a && !!b && a.trim().toUpperCase() === b.trim().toUpperCase();
}

/**
 * Dòng đang mở chi tiết của trang danh sách có link sâu: chưa thao tác → mở dòng có id = link.id, hoặc dòng đầu tiên
 * có một trong các mã (codesOf) trùng link.code khi dữ liệu về. Người dùng bấm dòng / đóng → theo state thường.
 */
export function useDeepLinkExpanded<T extends { id: string }>(
  items: T[] | undefined, link: DeepLink, codesOf: (item: T) => (string | null | undefined)[],
) {
  const [expanded, setExpanded] = useState<string | null | undefined>(link.id ?? (link.code ? undefined : null));
  const open = expanded !== undefined ? expanded
    : (items?.find((i) => codesOf(i).some((c) => sameCode(c, link.code)))?.id ?? null);
  const toggle = (id: string) => setExpanded(open === id ? null : id);
  return { open, setOpen: setExpanded as (id: string | null) => void, toggle };
}
