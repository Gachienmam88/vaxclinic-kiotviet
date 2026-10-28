"use client";

import { useEffect, useState } from "react";
import type { VnUnit } from "./vn-admin-search";

/** Tệp tĩnh danh mục ĐVHC 2 cấp (34 tỉnh/thành, 3.321 phường/xã/đặc khu). Service worker POS cache tệp này → dùng được offline. */
export const VN_ADMIN_URL = "/data/vn-admin-2025.json";

export type VnAdminData = {
  provinces: VnUnit[];
  wards: VnUnit[];
  provinceByCode: Map<string, VnUnit>;
  wardByCode: Map<string, VnUnit>;
  wardsOf: (provinceCode: string) => VnUnit[];
};

type RawFile = { provinces: VnUnit[]; wards: VnUnit[] };

let cached: VnAdminData | null = null;
let pending: Promise<VnAdminData> | null = null;

function index(raw: RawFile): VnAdminData {
  const byProvince = new Map<string, VnUnit[]>();
  for (const w of raw.wards) {
    const list = byProvince.get(w.provinceCode ?? "") ?? [];
    list.push(w);
    byProvince.set(w.provinceCode ?? "", list);
  }
  return {
    provinces: raw.provinces, wards: raw.wards,
    provinceByCode: new Map(raw.provinces.map((p) => [p.code, p])),
    wardByCode: new Map(raw.wards.map((w) => [w.code, w])),
    wardsOf: (code) => byProvince.get(code) ?? [],
  };
}

/** Tải 1 lần cho cả phiên (giữ trong bộ nhớ); lỗi mạng → lần gọi sau thử lại. */
export function loadVnAdmin(): Promise<VnAdminData> {
  if (cached) return Promise.resolve(cached);
  pending ??= fetch(VN_ADMIN_URL)
    .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() as Promise<RawFile>; })
    .then((raw) => (cached = index(raw)))
    .finally(() => { pending = null; });
  return pending;
}

/** Hook: null khi đang tải (hoặc tải lỗi — ô chọn khi đó vẫn hiện tên đã lưu). */
export function useVnAdmin(): VnAdminData | null {
  const [data, setData] = useState<VnAdminData | null>(cached);
  useEffect(() => {
    if (data) return;
    let alive = true;
    loadVnAdmin().then((d) => { if (alive) setData(d); }).catch(() => undefined);
    return () => { alive = false; };
  }, [data]);
  return data;
}
