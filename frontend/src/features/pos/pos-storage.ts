/**
 * Lưu trữ cục bộ của máy bán hàng (localStorage). Mọi đọc/ghi đều bọc try/catch:
 * trình duyệt chặn bộ nhớ / đầy bộ nhớ thì POS vẫn chạy, chỉ mất khả năng offline.
 */

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const KEYS = {
  catalog: (branchId: string) => `pos.catalog.${branchId}`,
  customers: "pos.customers",
  tabs: (userId: string) => `pos.tabs.${userId}`,
  queue: "pos.queue",
};

/** Lỗi mạng (không tới được server) → cho bán offline. Lỗi nghiệp vụ (400...) → báo người dùng. */
export function isNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) return true; // fetch failed: mất mạng / server Next không chạy
  const status = (e as { status?: number })?.status;
  return status === 502 || status === 503 || status === 504;
}

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));
