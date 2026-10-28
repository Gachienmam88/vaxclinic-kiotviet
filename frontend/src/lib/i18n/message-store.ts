/**
 * Kho message phía trình duyệt (cấp module): message đã tải theo (ngôn ngữ, namespace) + ngôn ngữ đang dùng.
 * - Tiếng Việt nằm sẵn trong bundle (mỗi namespace import tĩnh file vi của nó) nên không cần tải.
 * - en/ja/zh tải lười từng namespace bằng import() động → mỗi file JSON là 1 chunk riêng, chỉ tải khi màn hình cần.
 * Dùng được ngoài React (VD errorMessage() dịch lỗi API) qua getActiveLocale() / getLoadedMessages().
 */
import { DEFAULT_LOCALE, type Locale } from "./locales";
import type { MessageTree } from "./translate";

const loaded = new Map<string, MessageTree>();
const pending = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
/** Tăng mỗi lần có namespace mới nạp xong → useSyncExternalStore vẽ lại. Bắt đầu từ 1 (0 = snapshot server). */
let version = 1;
let activeLocale: Locale = DEFAULT_LOCALE;

const cacheKey = (locale: Locale, ns: string) => `${locale}/${ns}`;

function notify() {
  version += 1;
  listeners.forEach((l) => l());
}

export function subscribeMessages(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getMessagesVersion = () => version;

export function getLoadedMessages(locale: Locale, ns: string): MessageTree | undefined {
  return loaded.get(cacheKey(locale, ns));
}

/** Nạp message server đã gửi sẵn (I18nPreload) vào kho — gọi trong lúc render nên không notify. */
export function seedMessages(locale: Locale, bundle: Record<string, MessageTree>) {
  for (const [ns, tree] of Object.entries(bundle)) loaded.set(cacheKey(locale, ns), tree);
}

/** Tải 1 namespace (không phải tiếng Việt). Lỗi mạng/thiếu file → bỏ qua, giao diện tiếp tục dùng tiếng Việt. */
export function loadNamespace(locale: Locale, ns: string): Promise<void> {
  const key = cacheKey(locale, ns);
  if (locale === DEFAULT_LOCALE || loaded.has(key)) return Promise.resolve();
  let task = pending.get(key);
  if (!task) {
    task = import(`../../messages/${locale}/${ns}.json`)
      .then((mod: { default: MessageTree }) => { loaded.set(key, mod.default); })
      .catch((err) => { if (process.env.NODE_ENV !== "production") console.warn(`[i18n] không tải được ${key}`, err); })
      .finally(() => { pending.delete(key); notify(); });
    pending.set(key, task);
  }
  return task;
}

export const getActiveLocale = () => activeLocale;
export function setActiveLocale(locale: Locale) {
  activeLocale = locale;
}

const warned = new Set<string>();
/** Thiếu bản dịch → cảnh báo 1 lần / khóa, chỉ ở môi trường dev. */
export function warnMissing(locale: Locale, ns: string, key: string) {
  if (process.env.NODE_ENV === "production") return;
  const id = `${locale}:${ns}:${key}`;
  if (warned.has(id)) return;
  warned.add(id);
  console.warn(`[i18n] thiếu bản dịch ${id}`);
}
