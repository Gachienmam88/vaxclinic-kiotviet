"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_POS_SETTINGS, loadPosSettings, savePosSettings, type PosSettings } from "./pos-settings";

type Ctx = { settings: PosSettings; set: (patch: Partial<PosSettings>) => void };

const PosSettingsContext = createContext<Ctx>({ settings: DEFAULT_POS_SETTINGS, set: () => undefined });

/** Thiết lập màn bán hàng theo máy: đọc 1 lần khi mở, mỗi thay đổi ghi lại localStorage. */
export function PosSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PosSettings>(DEFAULT_POS_SETTINGS);
  useEffect(() => setSettings(loadPosSettings()), []);
  const set = useCallback((patch: Partial<PosSettings>) => setSettings((s) => {
    const next = { ...s, ...patch };
    savePosSettings(next);
    return next;
  }), []);
  const value = useMemo(() => ({ settings, set }), [settings, set]);
  return <PosSettingsContext.Provider value={value}>{children}</PosSettingsContext.Provider>;
}

export const usePosSettings = () => useContext(PosSettingsContext);
