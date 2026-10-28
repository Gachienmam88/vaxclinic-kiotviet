"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { KEYS, load, save } from "./pos-storage";
import type { CatalogProduct } from "./pos-types";

type Cached = { at: string; items: CatalogProduct[] };

/**
 * Danh mục hàng của màn bán hàng: lấy từ server, lưu cục bộ; mất mạng thì dùng bản đã lưu.
 * Tự làm mới mỗi 5 phút và sau mỗi lần bán (để số tồn hiển thị gần đúng).
 */
export function usePosCatalog(branchId: string) {
  const [cached, setCached] = useState<Cached | null>(null);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    if (!branchId) return;
    try {
      const items = await api<CatalogProduct[]>(`/products/pos-catalog?branchId=${branchId}`);
      const next = { at: new Date().toISOString(), items: items.map((p) => ({ ...p, stock: Number(p.stock),
        units: p.units.map((u) => ({ ...u, price: Number(u.price), conversionRate: Number(u.conversionRate) })) })) };
      setCached(next);
      setOffline(false);
      save(KEYS.catalog(branchId), next);
    } catch {
      setOffline(true);
      setCached((c) => c ?? load<Cached | null>(KEYS.catalog(branchId), null));
    }
  }, [branchId]);

  useEffect(() => {
    setCached(load<Cached | null>(KEYS.catalog(branchId), null));
    refresh();
    const t = setInterval(refresh, 5 * 60_000);
    return () => clearInterval(t);
  }, [branchId, refresh]);

  return { products: cached?.items ?? [], loadedAt: cached?.at ?? null, offline, refresh };
}

/** Tìm theo tên / mã hàng / mã vạch, bỏ dấu tiếng Việt để gõ "gardasil", "thuy dau" đều ra. */
export function searchCatalog(products: CatalogProduct[], text: string, limit = 20) {
  const q = normalize(text);
  if (!q) return [];
  const out: { product: CatalogProduct; unitId: string }[] = [];
  for (const p of products) {
    const unit = p.units.find((u) => normalize(u.code) === q || (u.barcode && normalize(u.barcode) === q))
      ?? (normalize(p.name).includes(q) || p.units.some((u) => normalize(u.code).includes(q)) ? p.units[0] : undefined);
    if (unit) out.push({ product: p, unitId: unit.id });
    if (out.length >= limit) break;
  }
  return out;
}

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
