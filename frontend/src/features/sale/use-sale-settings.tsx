"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_SALE_SETTINGS, mergeSettings, type SaleSettings } from "./sale-settings";
import { KEYS, load, save } from "./sale-storage";

type Ctx = { settings: SaleSettings; set: (patch: Partial<SaleSettings>) => void };

const SaleSettingsContext = createContext<Ctx>({ settings: DEFAULT_SALE_SETTINGS, set: () => undefined });

/** Thiết lập màn bán hàng theo máy: đọc 1 lần khi mở, mỗi thay đổi ghi lại localStorage. */
export function SaleSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SaleSettings>(DEFAULT_SALE_SETTINGS);
  useEffect(() => setSettings(mergeSettings(load<unknown>(KEYS.settings, null))), []);
  const set = useCallback((patch: Partial<SaleSettings>) => setSettings((s) => {
    const next = { ...s, ...patch };
    save(KEYS.settings, next);
    return next;
  }), []);
  const value = useMemo(() => ({ settings, set }), [settings, set]);
  return <SaleSettingsContext.Provider value={value}>{children}</SaleSettingsContext.Provider>;
}

export const useSaleSettings = () => useContext(SaleSettingsContext);
