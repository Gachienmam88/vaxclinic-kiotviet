"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { DeliveryPartner, PartnerList, SalesChannel } from "@/features/delivery/delivery-types";
import { KEYS, load, save } from "./sale-storage";

type PartnerOption = Pick<DeliveryPartner, "id" | "code" | "name" | "phone">;
type Lookups = { channels: SalesChannel[]; partners: PartnerOption[] };

const DIRECT: SalesChannel = { code: "DIRECT", name: "Bán trực tiếp", active: true, builtin: true, sortOrder: 0 };

/**
 * Kênh bán + đối tác giao hàng đang hoạt động cho màn bán hàng: tải từ server, lưu trên máy
 * → mất mạng vẫn chọn được kênh / đối tác (hóa đơn vào hàng đợi offline mang theo).
 */
export function useSaleLookups() {
  const [data, setData] = useState<Lookups>(() => load<Lookups>(KEYS.lookups, { channels: [DIRECT], partners: [] }));

  useEffect(() => {
    let alive = true;
    Promise.all([api<SalesChannel[]>("/sales-channels"), api<PartnerList>("/delivery-partners?active=true&size=200")])
      .then(([channels, partners]) => {
        if (!alive) return;
        const next = { channels: channels.length ? channels : [DIRECT],
          partners: partners.items.map(({ id, code, name, phone }) => ({ id, code, name, phone })) };
        setData(next);
        save(KEYS.lookups, next);
      })
      .catch(() => undefined); // mất mạng: dùng bản đã lưu
    return () => { alive = false; };
  }, []);

  /** Đối tác vừa thêm / sửa ở màn bán hàng: cập nhật ngay vào danh sách (và bản lưu trên máy); ngừng hoạt động thì bỏ khỏi danh sách. */
  const upsertPartner = useCallback((p: DeliveryPartner) => setData((prev) => {
    const rest = prev.partners.filter((x) => x.id !== p.id);
    const next = { ...prev, partners: p.active ? [{ id: p.id, code: p.code, name: p.name, phone: p.phone }, ...rest] : rest };
    save(KEYS.lookups, next);
    return next;
  }), []);

  return { ...data, upsertPartner };
}

export type SaleLookups = ReturnType<typeof useSaleLookups>;
