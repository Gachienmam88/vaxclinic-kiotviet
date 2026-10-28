"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LOCALE_COOKIE, LOCALE_INFO, LOCALE_STORAGE_KEY, isLocale, type Locale } from "./locales";
import { loadNamespace, seedMessages, setActiveLocale } from "./message-store";
import type { MessageTree } from "./translate";

/** Message server đã tải sẵn cho ngôn ngữ của cookie (I18nPreload) — dùng khi render server + lúc hydrate. */
type Seeds = { locale: Locale; messages: Record<string, MessageTree> };

type I18nState = { locale: Locale; setLocale: (locale: Locale) => void; seeds: Seeds };

const I18nContext = createContext<I18nState | null>(null);

/** Namespace dùng ngoài React (lỗi API) hoặc ở khắp nơi → tải ngay khi đổi ngôn ngữ. */
const EAGER_NAMESPACES = ["common", "errors"];

function persistLocale(locale: Locale) {
  try { localStorage.setItem(LOCALE_STORAGE_KEY, locale); } catch { /* chế độ riêng tư: chỉ còn cookie */ }
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = LOCALE_INFO[locale].htmlLang;
}

/** Bọc toàn app (components/providers.tsx). initialLocale đọc từ cookie ở root layout (server). */
export function I18nProvider({ initialLocale, seed, children }: {
  initialLocale: Locale; seed: Record<string, MessageTree>; children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  if (typeof window !== "undefined") setActiveLocale(locale); // errorMessage() đọc ngôn ngữ ngoài React

  const setLocale = useCallback((next: Locale) => {
    persistLocale(next);
    setActiveLocale(next);
    setLocaleState(next);
  }, []);

  useEffect(() => {
    // Cookie bị xóa nhưng thiết bị còn nhớ lựa chọn → khôi phục; chưa nhớ gì → ghi lại ngôn ngữ hiện tại.
    let stored: string | null = null;
    try { stored = localStorage.getItem(LOCALE_STORAGE_KEY); } catch { /* bỏ qua */ }
    if (isLocale(stored) && stored !== initialLocale) setLocale(stored);
    else if (!isLocale(stored)) persistLocale(initialLocale);
  }, [initialLocale, setLocale]);

  useEffect(() => {
    EAGER_NAMESPACES.forEach((ns) => void loadNamespace(locale, ns));
  }, [locale]);

  const seeds = useMemo<Seeds>(() => ({ locale: initialLocale, messages: seed }), [initialLocale, seed]);
  const value = useMemo(() => ({ locale, setLocale, seeds }), [locale, setLocale, seeds]);
  if (typeof window !== "undefined") seedMessages(initialLocale, seed);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Bổ sung message tải sẵn cho 1 nhánh (VD layout Thiết lập) — do I18nPreload (server) render. */
export function I18nSeed({ locale, messages, children }: {
  locale: Locale; messages: Record<string, MessageTree>; children: ReactNode;
}) {
  const parent = useI18nContext();
  if (typeof window !== "undefined") seedMessages(locale, messages);
  const value = useMemo<I18nState>(() => (parent.seeds.locale !== locale ? parent : {
    ...parent, seeds: { locale, messages: { ...parent.seeds.messages, ...messages } },
  }), [parent, locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18nContext(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("Thiếu <I18nProvider> (components/providers.tsx)");
  return ctx;
}

/** Ngôn ngữ giao diện hiện tại. */
export const useLocale = () => useI18nContext().locale;
/** Đổi ngôn ngữ: lưu localStorage + cookie, cập nhật <html lang>, cả app vẽ lại (namespace mới tải lười). */
export const useSetLocale = () => useI18nContext().setLocale;
