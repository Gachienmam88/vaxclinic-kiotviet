"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, LOCALE_INFO } from "./locales";
import { getLoadedMessages, getMessagesVersion, loadNamespace, subscribeMessages, warnMissing } from "./message-store";
import type { Namespace } from "./namespace";
import { translateKey, type MessageKey, type MessageTree, type TranslateVars } from "./translate";
import { useI18nContext } from "./i18n-provider";

export type TFunction<T extends MessageTree> = (key: MessageKey<T>, vars?: TranslateVars) => string;

/**
 * Hàm dịch cho 1 namespace: `const t = useT(settingsNs); t("users.title")`, `t("hello", { name })`,
 * `t("items", { count: 3 })` (khóa items_one / items_other). Thiếu bản dịch → tiếng Việt → chính khóa.
 * Lúc server render và lúc hydrate chỉ dùng message tải sẵn (I18nPreload) để HTML hai phía khớp nhau;
 * sau hydrate mới đọc kho đã tải lười (namespace chưa tải hiện tạm tiếng Việt rồi tự đổi khi tải xong).
 */
export function useT<T extends MessageTree>(ns: Namespace<T>): TFunction<T> {
  const { locale, seeds } = useI18nContext();
  // Server + lúc hydrate trả 0; sau đó là version của kho (≥ 1) → vẽ lại khi namespace tải xong.
  const version = useSyncExternalStore(subscribeMessages, getMessagesVersion, () => 0);
  const isVi = locale === DEFAULT_LOCALE;
  const seeded = seeds.locale === locale ? seeds.messages[ns.name] : undefined;
  const messages: MessageTree | undefined = isVi
    ? ns.vi
    : seeded ?? (version > 0 ? getLoadedMessages(locale, ns.name) : undefined);

  useEffect(() => {
    if (!isVi && !messages) void loadNamespace(locale, ns.name);
  }, [isVi, messages, locale, ns.name]);

  return useCallback<TFunction<T>>(
    (key, vars) => translateKey({
      key,
      vars,
      htmlLang: LOCALE_INFO[locale].htmlLang,
      messages,
      fallback: ns.vi,
      // Đang tải namespace thì chưa tính là thiếu
      onMissing: messages ? (k) => warnMissing(locale, ns.name, k) : undefined,
    }),
    [locale, messages, ns],
  );
}
