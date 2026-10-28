"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { DeliveryPartner, PartnerList, SalesChannel } from "@/features/delivery/delivery-types";
import { KEYS, load, save } from "./pos-storage";

type PartnerOption = Pick<DeliveryPartner, "id" | "code" | "name" | "phone">;
type Lookups = { channels: SalesChannel[]; partners: PartnerOption[] };

const DIRECT: SalesChannel = { code: "DIRECT", name: "Bán trực tiếp", active: true, builtin: true, sortOrder: 0 };

/**
 * Kênh bán + đối tác giao hàng đang hoạt động cho màn bán hàng: tải từ server, lưu trên máy
 * → mất mạng vẫn chọn được kênh / đối tác (hóa đơn vào hàng đợi offline mang theo).
 */
export function usePosLookups() {
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

  return data;
}

export type PosLookups = ReturnType<typeof usePosLookups>;
